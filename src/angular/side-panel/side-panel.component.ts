import { Component, Output, EventEmitter } from '@angular/core';

  styleUrls: ['./side-panel.component.css']
})
export class SidePanelComponent {
  options = [
    { label: 'Option 1', action: 'option1' },
    { label: 'Option 2', action: 'option2' },
    { label: 'Option 3', action: 'option3' },
  ];

  @Output() optionSelected = new EventEmitter<string>();

  handleOptionClick(option: any) {
    console.log(`Option clicked: ${option.label}`);
    this.optionSelected.emit(option.action);
    // Implement actions based on option.action here or in the parent component
    // For example, emit an event to the parent component
    //  - Verify that the correct action is emitted for each option.
  }
}
