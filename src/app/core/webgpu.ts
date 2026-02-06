import { Injectable, signal } from '@angular/core';

/**
 * Service WebGPU — gère le GPU, le pipeline de rendu et la boucle d'affichage.
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
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private animationId: number | null = null;

  /**
   * Initialise WebGPU.
   * Retourne true si tout est OK, false sinon.
   */
  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      this.isSupported.set(false);
      this.error.set('WebGPU n\'est pas supporté par ce navigateur.');
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter();

      if (!this.adapter) {
        this.isSupported.set(false);
        this.error.set('Aucun adaptateur GPU trouvé. Votre GPU ne supporte peut-être pas WebGPU.');
        console.error('❌ requestAdapter() a retourné null');
        return false;
      }

      console.log('✅ Adapter obtenu:', this.adapter.info);

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
      label: 'Fullscreen quad shader',
      code: shaderCode
    });

    // Vérifier les erreurs de compilation (async, non-bloquant)
    shaderModule.getCompilationInfo().then(info => {
      for (const msg of info.messages) {
        console.warn(`⚠️ Shader ${msg.type}: ${msg.message} [ligne ${msg.lineNum}:${msg.linePos}]`);
      }
    });

    // Créer le pipeline
    const pipeline = this.device.createRenderPipeline({
      label: 'Fullscreen quad pipeline',
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
      renderPass.draw(6);
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
