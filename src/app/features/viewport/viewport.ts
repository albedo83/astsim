import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { WebGPU } from '../../core/webgpu';
import shaderCode from '../../../assets/shaders/triangle.wgsl?raw';

@Component({
  selector: 'app-viewport',
  templateUrl: './viewport.html',
  styleUrl: './viewport.scss',
})
export class Viewport implements OnInit {
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
console.log('Shader code:', shaderCode);
    // Étape 3 : Créer le pipeline de rendu
    this.statusMessage.set('Compilation des shaders...');
    const pipeline = this.webgpu.createRenderPipeline(shaderCode);

    if (!pipeline) {
      this.statusMessage.set('Erreur de création du pipeline');
      this.hasError.set(true);
      return;
    }

    // Étape 4 : Dessiner le triangle !
    this.webgpu.renderTriangle(context, pipeline);

    this.isReady.set(true);
    this.statusMessage.set('WebGPU opérationnel ! 🚀');
  }
}
