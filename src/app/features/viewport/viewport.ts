import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { WebGPU } from '../../core/webgpu';
import shaderCode from '../../../assets/shaders/fullscreen-quad.wgsl?raw';

@Component({
  selector: 'app-viewport',
  templateUrl: './viewport.html',
  styleUrl: './viewport.scss',
})
export class Viewport implements OnInit, OnDestroy {
  // Injection du service
  private webgpu = inject(WebGPU);

  // Référence au canvas dans le template
  @ViewChild('gpuCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // État local du composant
  readonly isReady = signal(false);
  readonly statusMessage = signal('Initialisation...');
  readonly hasError = signal(false);

  async ngOnInit(): Promise<void> {
    // Étape 1 : Initialiser WebGPU
    this.statusMessage.set('Connexion au GPU...');
    const success = await this.webgpu.initialize();

    if (!success) {
      this.statusMessage.set(this.webgpu.error() ?? 'Erreur inconnue');
      this.hasError.set(true);
      return;
    }

    // Étape 2 : Configurer le canvas
    this.statusMessage.set('Configuration du canvas...');
    const canvas = this.canvasRef.nativeElement;
    const context = this.webgpu.configureCanvas(canvas);

    if (!context) {
      this.statusMessage.set('Impossible de configurer le canvas');
      this.hasError.set(true);
      return;
    }

// Étape 3 : Créer le pipeline avec notre shader
    this.statusMessage.set('Compilation des shaders...');
    const pipeline = this.webgpu.createRenderPipeline(shaderCode);

    if (!pipeline) {
      this.statusMessage.set('Erreur de création du pipeline');
      return;
    }

    // Étape 4 : Créer les uniforms (le tuyau CPU → GPU)
    this.statusMessage.set('Préparation des uniforms...');
    const uniformsReady = this.webgpu.createUniforms(pipeline);

    if (!uniformsReady) {
      this.statusMessage.set('Erreur de création des uniforms');
      return;
    }

    // Étape 5 : Lancer la boucle de rendu !
    this.webgpu.startRenderLoop(context, pipeline);

    this.isReady.set(true);
    this.statusMessage.set('Rendu en cours 🎬');
  }

  ngOnDestroy(): void {
    this.webgpu.stopRenderLoop();
  }
}
