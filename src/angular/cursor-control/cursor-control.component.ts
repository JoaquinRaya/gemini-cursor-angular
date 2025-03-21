import { Component, Input } from '@angular/core';

 ...<snip>... 
  styleUrls: ['./cursor-control.component.css']
})
export class CursorControlComponent {
  @Input() lastCapturedFrame: string | null = null;
}
