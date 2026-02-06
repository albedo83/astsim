import { Component } from '@angular/core';
import { Viewport } from './features/viewport/viewport';

@Component({
  selector: 'app-root',
  imports: [Viewport],
  template: `
    <main>
      <app-viewport />
    </main>
  `,
  styles: [
    `
      main {
        min-height: 100vh;
        background: #0a0a0f;
        color: white;
        font-family: system-ui, sans-serif;
      }

      h1 {
        text-align: center;
        padding: 20px;
        margin: 0;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
      }
    `,
  ],
})
export class App {}
