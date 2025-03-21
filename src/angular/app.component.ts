import { Component, OnInit } from '@angular/core';
 ...<snip>... 
 ...<snip>... 

  onStreamChange(stream: MediaStream | null) {
    this.videoStream = stream;
  }
}
