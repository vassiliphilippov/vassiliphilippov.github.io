/**
 * YouTube Examples Player Component
 * 
 * A reusable YouTube player for displaying example sentences with video clips.
 * 
 * Usage:
 *   const player = new YouTubeExamplesPlayer('container-id', jsonlData);
 *   player.initialize();
 */

class YouTubeExamplesPlayer {
    constructor(containerId, jsonlDataOrArray) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        
        // Parse JSONL if string, otherwise use array
        if (typeof jsonlDataOrArray === 'string') {
            this.examples = this._parseJsonl(jsonlDataOrArray);
        } else if (Array.isArray(jsonlDataOrArray)) {
            this.examples = jsonlDataOrArray;
        } else {
            throw new Error('Data must be JSONL string or array of examples');
        }
        
        // State
        this.currentIndex = 0;
        this.player = null;
        this.isPlayerReady = false;
        this.progressInterval = null;
        this.isAdvancing = false;
        this.wasPlaying = false;
        
        // Element references (will be set after render)
        this.elements = {};
    }
    
    _parseJsonl(jsonlString) {
        return jsonlString.trim().split('\n').map(line => JSON.parse(line));
    }
    
    _formatSeconds(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    
    _renderHtml() {
        this.container.innerHTML = `
            <div class="youtube-examples-player">
                <div class="video-container">
                    <div id="${this.containerId}-player"></div>
                    <div class="custom-controls">
                        <button class="play-pause-btn" id="${this.containerId}-play-pause">
                            <svg id="${this.containerId}-play-icon" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            <svg id="${this.containerId}-pause-icon" viewBox="0 0 24 24" style="display: none;">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                        </button>
                        <div class="progress-bar" id="${this.containerId}-progress-bar">
                            <div class="progress-filled" id="${this.containerId}-progress-filled"></div>
                        </div>
                        <div class="time-display" id="${this.containerId}-time-display">0:00 / 0:00</div>
                    </div>
                </div>
                
                <div class="content-area">
                    <div class="phrase-section">
                        <button class="nav-button" id="${this.containerId}-prev-btn" title="Previous (←)">‹</button>
                        <div class="phrase-text" id="${this.containerId}-phrase-text">
                            <div class="loading">Loading examples...</div>
                        </div>
                        <button class="nav-button" id="${this.containerId}-next-btn" title="Next (→)">›</button>
                    </div>
                    
                    <div class="dots-container" id="${this.containerId}-dots-container"></div>
                </div>
            </div>
        `;
        
        // Cache element references
        this.elements = {
            prevBtn: document.getElementById(`${this.containerId}-prev-btn`),
            nextBtn: document.getElementById(`${this.containerId}-next-btn`),
            playPauseBtn: document.getElementById(`${this.containerId}-play-pause`),
            playIcon: document.getElementById(`${this.containerId}-play-icon`),
            pauseIcon: document.getElementById(`${this.containerId}-pause-icon`),
            progressBar: document.getElementById(`${this.containerId}-progress-bar`),
            progressFilled: document.getElementById(`${this.containerId}-progress-filled`),
            timeDisplay: document.getElementById(`${this.containerId}-time-display`),
            phraseText: document.getElementById(`${this.containerId}-phrase-text`),
            dotsContainer: document.getElementById(`${this.containerId}-dots-container`)
        };
    }
    
    _initializeDots() {
        this.elements.dotsContainer.innerHTML = '';
        this.examples.forEach((example, index) => {
            const dot = document.createElement('div');
            dot.className = 'dot';
            if (index === this.currentIndex) {
                dot.classList.add('active');
            }
            if (example.unavailable) {
                dot.style.display = 'none';
            }
            dot.addEventListener('click', () => {
                if (!example.unavailable) {
                    this.isAdvancing = false;
                    this.currentIndex = index;
                    this._updateDisplay();
                }
            });
            this.elements.dotsContainer.appendChild(dot);
        });
    }
    
    _updateDots() {
        const dots = this.elements.dotsContainer.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            if (this.examples[index].unavailable) {
                dot.style.display = 'none';
            } else if (index === this.currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
    _updateProgress() {
        if (this.player && this.player.getCurrentTime) {
            const example = this.examples[this.currentIndex];
            const startSeconds = example.start_ms / 1000;
            const endSeconds = example.end_ms / 1000;
            const duration = endSeconds - startSeconds;
            const currentTime = this.player.getCurrentTime();
            const elapsed = Math.max(0, currentTime - startSeconds);
            const progress = Math.min(100, (elapsed / duration) * 100);
            
            this.elements.progressFilled.style.width = `${progress}%`;
            this.elements.timeDisplay.textContent = 
                `${this._formatSeconds(elapsed)} / ${this._formatSeconds(duration)}`;
            
            // Check if we've reached the end (only advance once)
            if (currentTime >= endSeconds && !this.isAdvancing) {
                // Stop the interval immediately
                if (this.progressInterval) {
                    clearInterval(this.progressInterval);
                    this.progressInterval = null;
                }
                this._advanceToNext();
            }
        }
    }
    
    _advanceToNext() {
        this.isAdvancing = true;
        
        // Find next available video
        let nextIndex = this.currentIndex + 1;
        while (nextIndex < this.examples.length && this.examples[nextIndex].unavailable) {
            nextIndex++;
        }
        
        if (nextIndex < this.examples.length) {
            setTimeout(() => {
                this.currentIndex = nextIndex;
                this._updateDisplay();
                this.isAdvancing = false;
            }, 500);
        } else {
            this.player.pauseVideo();
            setTimeout(() => {
                this.isAdvancing = false;
            }, 2000);
        }
    }
    
    _updateDisplay() {
        const example = this.examples[this.currentIndex];
        
        // Update phrase
        this.elements.phraseText.innerHTML = example.phrase;
        
        // Update dots
        this._updateDots();
        
        // Update button states
        this.elements.prevBtn.disabled = this.currentIndex === 0;
        this.elements.nextBtn.disabled = this.currentIndex === this.examples.length - 1;
        
        // Load video if player is ready
        if (this.isPlayerReady && this.player) {
            this._loadCurrentVideo();
        }
    }
    
    _loadCurrentVideo() {
        const example = this.examples[this.currentIndex];
        const startSeconds = example.start_ms / 1000;
        
        // If user was playing, auto-start the next video; otherwise just cue it
        if (this.wasPlaying) {
            this.player.loadVideoById({
                videoId: example.video_id,
                startSeconds: startSeconds
            });
        } else {
            this.player.cueVideoById({
                videoId: example.video_id,
                startSeconds: startSeconds
            });
        }
    }
    
    _onYouTubeIframeAPIReady() {
        this.player = new YT.Player(`${this.containerId}-player`, {
            height: '100%',
            width: '100%',
            videoId: this.examples[0].video_id,
            playerVars: {
                'autoplay': 0,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'modestbranding': 1,
                'rel': 0,
                'showinfo': 0,
                'iv_load_policy': 3,
                'playsinline': 1,
                'enablejsapi': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': () => this._onPlayerReady(),
                'onStateChange': (event) => this._onPlayerStateChange(event),
                'onError': (event) => this._onPlayerError(event)
            }
        });
    }
    
    _onPlayerReady() {
        this.isPlayerReady = true;
        this._initializeDots();
        this._updateDisplay();
    }
    
    _onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.wasPlaying = true;
            this.elements.playIcon.style.display = 'none';
            this.elements.pauseIcon.style.display = 'block';
            
            // Start progress monitoring
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
            }
            this.progressInterval = setInterval(() => this._updateProgress(), 100);
        } else if (event.data === YT.PlayerState.PAUSED) {
            this.wasPlaying = false;
            this.elements.playIcon.style.display = 'block';
            this.elements.pauseIcon.style.display = 'none';
            
            // Stop progress monitoring
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
        } else {
            this.elements.playIcon.style.display = 'block';
            this.elements.pauseIcon.style.display = 'none';
            
            // Stop progress monitoring
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
        }
    }
    
    _onPlayerError(event) {
        const errorCode = event.data;
        // Error codes: 100 (not found), 101/150 (embedding not allowed)
        if ([100, 101, 150].includes(errorCode)) {
            console.warn(`YouTube video unavailable (error ${errorCode}), hiding player for video ${this.examples[this.currentIndex].video_id}`);
            
            // Mark this example as unavailable
            this.examples[this.currentIndex].unavailable = true;
            
            // Try to skip to next available video
            this._skipUnavailableVideo();
        }
    }
    
    _skipUnavailableVideo() {
        // Find next available video
        let nextIndex = this.currentIndex + 1;
        while (nextIndex < this.examples.length && this.examples[nextIndex].unavailable) {
            nextIndex++;
        }
        
        if (nextIndex < this.examples.length) {
            // Found an available video, skip to it
            this.currentIndex = nextIndex;
            this._updateDisplay();
        } else {
            // Try to find a previous available video
            let prevIndex = this.currentIndex - 1;
            while (prevIndex >= 0 && this.examples[prevIndex].unavailable) {
                prevIndex--;
            }
            
            if (prevIndex >= 0) {
                this.currentIndex = prevIndex;
                this._updateDisplay();
            } else {
                // All videos unavailable, hide the entire player
                this.container.style.display = 'none';
                console.error('All YouTube videos are unavailable, hiding player');
            }
        }
    }
    
    _attachEventListeners() {
        // Play/Pause button
        this.elements.playPauseBtn.addEventListener('click', () => {
            if (this.player && this.player.getPlayerState) {
                const state = this.player.getPlayerState();
                if (state === YT.PlayerState.PLAYING) {
                    this.player.pauseVideo();
                } else {
                    this.player.playVideo();
                }
            }
        });
        
        // Progress bar click
        this.elements.progressBar.addEventListener('click', (e) => {
            const rect = this.elements.progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;
            
            const example = this.examples[this.currentIndex];
            const startSeconds = example.start_ms / 1000;
            const endSeconds = example.end_ms / 1000;
            const duration = endSeconds - startSeconds;
            const newTime = startSeconds + (duration * percentage);
            
            this.player.seekTo(newTime, true);
        });
        
        // Navigation buttons
        this.elements.prevBtn.addEventListener('click', () => {
            if (this.currentIndex > 0) {
                this.isAdvancing = false;
                // Find previous available video
                let prevIndex = this.currentIndex - 1;
                while (prevIndex >= 0 && this.examples[prevIndex].unavailable) {
                    prevIndex--;
                }
                if (prevIndex >= 0) {
                    this.currentIndex = prevIndex;
                    this._updateDisplay();
                }
            }
        });
        
        this.elements.nextBtn.addEventListener('click', () => {
            if (this.currentIndex < this.examples.length - 1) {
                this.isAdvancing = false;
                // Find next available video
                let nextIndex = this.currentIndex + 1;
                while (nextIndex < this.examples.length && this.examples[nextIndex].unavailable) {
                    nextIndex++;
                }
                if (nextIndex < this.examples.length) {
                    this.currentIndex = nextIndex;
                    this._updateDisplay();
                }
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && this.currentIndex > 0) {
                this.isAdvancing = false;
                // Find previous available video
                let prevIndex = this.currentIndex - 1;
                while (prevIndex >= 0 && this.examples[prevIndex].unavailable) {
                    prevIndex--;
                }
                if (prevIndex >= 0) {
                    this.currentIndex = prevIndex;
                    this._updateDisplay();
                }
            } else if (e.key === 'ArrowRight' && this.currentIndex < this.examples.length - 1) {
                this.isAdvancing = false;
                // Find next available video
                let nextIndex = this.currentIndex + 1;
                while (nextIndex < this.examples.length && this.examples[nextIndex].unavailable) {
                    nextIndex++;
                }
                if (nextIndex < this.examples.length) {
                    this.currentIndex = nextIndex;
                    this._updateDisplay();
                }
            } else if (e.key === ' ') {
                e.preventDefault();
                if (this.player && this.player.getPlayerState) {
                    const state = this.player.getPlayerState();
                    if (state === YT.PlayerState.PLAYING) {
                        this.player.pauseVideo();
                    } else {
                        this.player.playVideo();
                    }
                }
            }
        });
    }
    
    initialize() {
        // Render HTML structure
        this._renderHtml();
        
        // Attach event listeners
        this._attachEventListeners();
        
        // Load YouTube IFrame API if not already loaded
        if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
            window.onYouTubeIframeAPIReady = () => {
                this._onYouTubeIframeAPIReady();
            };
            
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            // API already loaded
            this._onYouTubeIframeAPIReady();
        }
    }
    
    // Public API methods
    goToExample(index) {
        if (index >= 0 && index < this.examples.length) {
            this.currentIndex = index;
            this._updateDisplay();
        }
    }
    
    play() {
        if (this.player) {
            this.player.playVideo();
        }
    }
    
    pause() {
        if (this.player) {
            this.player.pauseVideo();
        }
    }
    
    destroy() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        if (this.player) {
            this.player.destroy();
        }
        this.container.innerHTML = '';
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = YouTubeExamplesPlayer;
}

