import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  apiKey: string = '';
  apiKeyStorageKey: string = 'geminiApiKey';

  ngOnInit() {
    const savedApiKey = localStorage.getItem(this.apiKeyStorageKey);
    if (savedApiKey) {
      this.apiKey = savedApiKey;
    }
  }

  handleApiKeySubmit(event: Event) {
    event.preventDefault();
    if (this.apiKey.trim()) {
      localStorage.setItem(this.apiKeyStorageKey, this.apiKey);
    }
  }
}
