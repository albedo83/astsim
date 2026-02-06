import { Injectable, signal } from '@angular/core';

/**
 * Service d'initialisation WebGPU
 *
 * ÉTAPE 1 : On vérifie juste que WebGPU est disponible et on récupère un device.
 * C'est l'équivalent de "est-ce que mon télescope est branché et allumé ?"
 */
@Injectable({
  providedIn: 'root',
})
export class WebGPU {
  // Signaux pour l'état (Angular 21 style)
  readonly isSupported = signal<boolean | null>(null); // null = pas encore testé
  readonly error = signal<string | null>(null);

  // Les objets WebGPU qu'on va utiliser partout
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private canvasFormat: GPUTextureFormat = 'bgra8unorm';
    // --- Animation & Uniforms ---
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private animationId: number | null = null;

  /**
   * Initialise WebGPU.
   * Retourne true si tout est OK, false sinon.
   */
  async initialize(): Promise<boolean> {
    // Étape 1 : Le navigateur supporte-t-il WebGPU ?
    console.log('🔍 Vérification WebGPU...');
    console.log('navigator.gpu:', navigator.gpu);
    console.log('typeof navigator.gpu:', typeof navigator.gpu);

    if (!navigator.gpu) {
      this.isSupported.set(false);
      const userAgent = navigator.userAgent;
      const isSecureContext = window.isSecureContext;
      this.error.set(
        `WebGPU n'est pas supporté par ce navigateur.\n` +
          `User-Agent: ${userAgent}\n` +
          `Secure context: ${isSecureContext}\n` +
          `navigator.gpu: ${navigator.gpu}`,
      );
      console.error('❌ navigator.gpu est undefined/null');
      return false;
    }

    try {
      // Étape 2 : Demander un "adapter" (représentation du GPU physique)
      // C'est comme demander "quel télescope est disponible ?"
      this.adapter = await navigator.gpu.requestAdapter();

      if (!this.adapter) {
        this.isSupported.set(false);
        this.error.set('Aucun adaptateur GPU trouvé. Votre GPU ne supporte peut-être pas WebGPU.');
        console.error('❌ requestAdapter() a retourné null');
        return false;
      }

      console.log('✅ Adapter obtenu:', this.adapter.info);

      // Étape 3 : Demander un "device" (notre interface de travail)
      // C'est comme obtenir la télécommande du télescope
      this.device = await this.adapter.requestDevice();

      // Écouter les erreurs GPU (très utile pour le debug)
      this.device.lost.then((info) => {
        console.error('GPU device lost:', info.message);
        this.error.set(`GPU perdu: ${info.message}`);
      });

      this.isSupported.set(true);
      console.log('✅ WebGPU initialisé avec succès !');
      console.log('GPU:', this.adapter.info);

      return true;
    } catch (e) {
      this.isSupported.set(false);
      this.error.set(`Erreur d'initialisation: ${e}`);
      return false;
    }
  }

  /**
   * Configure un canvas pour le rendu WebGPU.
   * Retourne le contexte configuré ou null si erreur.
   */
  configureCanvas(canvas: HTMLCanvasElement): GPUCanvasContext | null {
    if (!this.device) {
      console.error('WebGPU non initialisé !');
      return null;
    }

    // Récupérer le contexte WebGPU du canvas
    const context = canvas.getContext('webgpu');
    if (!context) {
      console.error("Impossible d'obtenir le contexte WebGPU");
      return null;
    }

    // Configurer le contexte
    // Le format préféré dépend du système (généralement 'bgra8unorm' ou 'rgba8unorm')
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.canvasFormat = format;
    context.configure({
      device: this.device,
      format: format,
      // alphaMode: 'premultiplied' // Si on veut de la transparence
    });

    console.log(`Canvas configuré avec le format: ${format}`);
    return context;
  }

  /**
   * Remplit le canvas avec une couleur unie.
   * C'est notre premier "render pass" - le plus simple possible.
   *
   * @param context - Le contexte WebGPU du canvas
   * @param color - Couleur RGBA (valeurs entre 0 et 1)
   */
  clearWithColor(
    context: GPUCanvasContext,
    color: { r: number; g: number; b: number; a: number },
  ): void {
    if (!this.device) return;

    // Obtenir la texture actuelle du canvas (là où on va dessiner)
    const textureView = context.getCurrentTexture().createView();

    // Créer un "command encoder" - c'est comme un enregistreur de commandes
    // On enregistre ce qu'on veut faire, puis on envoie tout d'un coup au GPU
    const commandEncoder = this.device.createCommandEncoder();

    // Créer un "render pass" - une passe de rendu
    // Pour l'instant, on fait juste un "clear" (effacement avec une couleur)
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: color, // La couleur de fond
          loadOp: 'clear', // Effacer avec clearValue
          storeOp: 'store', // Garder le résultat
        },
      ],
    });

    // Fin du render pass (on n'a rien dessiné, juste effacé)
    renderPass.end();

    // Soumettre les commandes au GPU
    this.device.queue.submit([commandEncoder.finish()]);
  }

  // Getter pour le device (on en aura besoin plus tard)
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Crée un pipeline de rendu à partir du code WGSL.
   * 
   * Un pipeline = la recette complète pour dessiner :
   * - Quels shaders utiliser
   * - Dans quel format écrire les pixels
   */
  createRenderPipeline(shaderCode: string): GPURenderPipeline | null {
    if (!this.device) return null;

    // Compiler le code WGSL en module shader
    const shaderModule = this.device.createShaderModule({
      label: 'Triangle shader',
      code: shaderCode
    });

    // Créer le pipeline
    const pipeline = this.device.createRenderPipeline({
      label: 'Triangle pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.canvasFormat
        }]
      }
    });

    console.log('✅ Pipeline de rendu créé');
    return pipeline;
  }

  /**
   * Crée le Uniform Buffer et le Bind Group.
   *
   * Un Uniform Buffer, c'est une petite zone mémoire sur le GPU
   * où TypeScript peut écrire des valeurs que le shader va lire.
   *
   * Le Bind Group fait le lien : "ce buffer → va dans @group(0) @binding(0)"
   */
  createUniforms(pipeline: GPURenderPipeline): boolean {
    if (!this.device) return false;

    // Créer le buffer (4 octets = 1 float32 pour le temps)
    this.uniformBuffer = this.device.createBuffer({
      label: 'Uniforms buffer',
      size: 4, // 1 x float32 = 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Créer le bind group : connecter le buffer au shader
    this.bindGroup = this.device.createBindGroup({
      label: 'Uniforms bind group',
      layout: pipeline.getBindGroupLayout(0), // group(0) du shader
      entries: [{
        binding: 0,           // @binding(0) du shader
        resource: {
          buffer: this.uniformBuffer
        }
      }]
    });

    console.log('✅ Uniforms créés');
    return true;
  }

/**
   * Lance la boucle de rendu continue.
   * Comme le live view de ta caméra astro : 
   * ça tourne en permanence et met à jour l'image.
   */
  startRenderLoop(context: GPUCanvasContext, pipeline: GPURenderPipeline): void {
    const startTime = performance.now();

    const frame = () => {
      if (!this.device || !this.uniformBuffer || !this.bindGroup) return;

      // Calculer le temps écoulé en secondes
      const time = (performance.now() - startTime) / 1000;

      // Écrire le temps dans le uniform buffer
      // C'est comme tourner la molette "exposition" en continu
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        0,                              // offset dans le buffer
        new Float32Array([time])        // les données à écrire
      );

      // --- Dessiner une frame ---
      const commandEncoder = this.device.createCommandEncoder();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.05, g: 0.05, b: 0.15, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });

      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, this.bindGroup);  // Brancher les uniforms !
      renderPass.draw(3);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // Demander la frame suivante (~60fps)
      this.animationId = requestAnimationFrame(frame);
    };

    // Lancer !
    frame();
  }

  /**
   * Arrête la boucle de rendu.
   */
  stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      console.log('⏹️ Boucle de rendu arrêtée');
    }
  }
}
