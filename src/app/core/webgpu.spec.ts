import { TestBed } from '@angular/core/testing';

import { WebGPU } from './webgpu';

describe('WebGPU', () => {
  let service: WebGPU;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebGPU);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
