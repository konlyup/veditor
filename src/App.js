import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [tracks, setTracks] = useState([
    { id: 1, clips: [] },
    { id: 2, clips: [] },
    { id: 3, clips: [] }
  ]);

  const [mediaLibrary, setMediaLibrary] = useState([]);
  const timelineRef = useRef(null);
  const videoRef = useRef(null);
  const [timelineScroll, setTimelineScroll] = useState(0);
  const VISIBLE_DURATION = 30; // 30 seconds visible at a time
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [selectedClip, setSelectedClip] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [activeClips, setActiveClips] = useState([]);
  const [clipImages, setClipImages] = useState(new Map());
  const [selectedClipOverlay, setSelectedClipOverlay] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 });


  // Create image elements for clips
  const createClipImage = (clip) => {
    if (clip.type === 'image') {
      const img = new Image();
      img.src = clip.url;
      clipImages.set(clip.clipId, img);
    }
  };

  // Enhanced renderCanvas function with better time checking
  const renderCanvas = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });

      // Clear canvas and draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Find and update active clips with proper time checking
      const currentActive = tracks.flatMap(track =>
        track.clips.filter(clip => {
          // Get clip duration (default to 5 if not set)
          const clipDuration = clip.duration || 5;
          // Calculate end time
          const clipEnd = parseFloat(clip.start) + clipDuration;
          // Get current time with precision
          const videoTime = parseFloat(currentTime.toFixed(3));

          console.log(`Clip ${clip.clipId}: Start=${clip.start}, End=${clipEnd}, Current=${videoTime}`);

          return videoTime >= parseFloat(clip.start) && videoTime <= clipEnd;
        }).map(clip => ({
          ...clip,
          position: clip.position || {
            x: canvas.width / 4,
            y: canvas.height / 4,
            width: canvas.width / 2,
            height: canvas.height / 2
          }
        }))
      );

      // Update active clips state if changed
      if (JSON.stringify(currentActive) !== JSON.stringify(activeClips)) {
        setActiveClips(currentActive);
        // Create images for new clips
        currentActive.forEach(clip => {
          if (!clipImages.has(clip.clipId)) {
            createClipImage(clip);
          }
        });
      }

      // Draw active clips
      currentActive.forEach(clip => {
        ctx.save();

        // Draw the clip content
        if (clip.type === 'image') {
          const img = clipImages.get(clip.clipId);
          if (img && img.complete) {
            ctx.drawImage(img,
              clip.position.x,
              clip.position.y,
              clip.position.width,
              clip.position.height
            );
          }
        } else {
          ctx.drawImage(video,
            clip.position.x,
            clip.position.y,
            clip.position.width,
            clip.position.height
          );
        }

        // Draw selection border and resize handle if selected
        if (clip === selectedClipOverlay) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            clip.position.x,
            clip.position.y,
            clip.position.width,
            clip.position.height
          );

          // Draw resize handle
          ctx.fillStyle = '#00ff00';
          const handleSize = 10;
          ctx.fillRect(
            clip.position.x + clip.position.width - handleSize,
            clip.position.y + clip.position.height - handleSize,
            handleSize,
            handleSize
          );
        }

        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(renderCanvas);
    }
  };

  // Handle video load and setup
  const handleVideoLoad = () => {
    if (videoRef.current) {
      const video = videoRef.current;

      // Set canvas size to match video
      setVideoSize({
        width: video.videoWidth,
        height: video.videoHeight
      });

      // Set video duration
      setVideoDuration(video.duration);

      // Start canvas rendering
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderCanvas();
    }
  };

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update video time handler to ensure precision
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      console.log(123)
      setCurrentTime(parseFloat(videoRef.current.currentTime.toFixed(3)));
    }
  };

  const handleTimelineClick = (e) => {
    if (timelineRef.current && videoRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickPosition = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = Math.min(videoDuration, clickPosition * videoDuration);

      if (isFinite(newTime) && newTime >= 0) {
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
  };

  const handleTimelineScroll = (e) => {
    const scrollPosition = e.target.scrollLeft;
    const maxScroll = e.target.scrollWidth - e.target.clientWidth;
    const scrollRatio = scrollPosition / maxScroll;
    const timeOffset = scrollRatio * (videoDuration - VISIBLE_DURATION);
    setTimelineScroll(timeOffset);
  };

  useEffect(() => {
    // Auto-scroll timeline when video plays past visible area
    if (timelineRef.current && currentTime > timelineScroll + VISIBLE_DURATION) {
      const newScroll = Math.floor(currentTime / VISIBLE_DURATION) * VISIBLE_DURATION;
      setTimelineScroll(newScroll);

      // Calculate scroll position
      const scrollRatio = newScroll / (videoDuration - VISIBLE_DURATION);
      const maxScroll = timelineRef.current.scrollWidth - timelineRef.current.clientWidth;
      timelineRef.current.scrollLeft = scrollRatio * maxScroll;
    }
  }, [currentTime, videoDuration, timelineScroll]);

  // Handle video upload
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      // Reset canvas when new video is loaded
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      // Create a temporary video element to get duration
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        setVideoDuration(tempVideo.duration);
      };
    }
  };

  const handleMediaUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const isVideo = file.type.includes('video');
      if (isVideo) {
        // For video files, get their actual duration
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.onloadedmetadata = () => {
          setMediaLibrary([...mediaLibrary, {
            id: Date.now(),
            type: 'video',
            url: url,
            name: file.name,
            duration: video.duration
          }]);
        };
      } else {
        // For images, set default duration to 5 seconds
        setMediaLibrary([...mediaLibrary, {
          id: Date.now(),
          type: 'image',
          url: URL.createObjectURL(file),
          name: file.name,
          duration: 5 // Default 5 seconds for images
        }]);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    // Add a class to indicate valid drop target
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    // Remove the class when dragging leaves
    e.currentTarget.classList.remove('drag-over');
  };

  // Update handleTrackDrop to ensure proper time values
  const handleTrackDrop = (e, trackId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      const data = JSON.parse(jsonData);
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const dropX = e.clientX - timelineRect.left;
      // Calculate drop time position with precision
      const dropTimePosition = parseFloat(
        ((dropX / timelineRect.width) * VISIBLE_DURATION + timelineScroll).toFixed(3)
      );

      // Initialize default position for new clips
      const defaultPosition = canvasRef.current ? {
        x: canvasRef.current.width / 4,
        y: canvasRef.current.height / 4,
        width: canvasRef.current.width / 2,
        height: canvasRef.current.height / 2
      } : null;

      if (data.type === 'clip') {
        setTracks(tracks.map(track => {
          if (track.id === trackId) {
            return {
              ...track,
              clips: [...track.clips, {
                ...data.clip,
                clipId: Date.now(),
                start: dropTimePosition,
                duration: parseFloat(data.clip.duration) || 5,
                width: `${((data.clip.duration || 5) / VISIBLE_DURATION) * 100}%`,
                position: defaultPosition
              }]
            };
          }
          return track;
        }));
      } else {
        const defaultDuration = data.type === 'image' ? 5 : parseFloat(data.duration) || 5;
        setTracks(tracks.map(track => {
          if (track.id === trackId) {
            return {
              ...track,
              clips: [...track.clips, {
                ...data,
                clipId: Date.now(),
                start: dropTimePosition,
                duration: defaultDuration,
                width: `${(defaultDuration / VISIBLE_DURATION) * 100}%`,
                position: defaultPosition
              }]
            };
          }
          return track;
        }));
      }
    } catch (error) {
      console.error('Error processing dropped item:', error);
    }
  };

  const handleClipDragStart = (e, trackId, clip) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'clip',
      trackId,
      clip
    }));
  };

  const handleTimelineDrop = (e) => {
    e.preventDefault();
    // Only handle drops from media library, not from existing clips
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      const data = JSON.parse(jsonData);
      // Only proceed if it's not a clip drag
      if (data.type !== 'clip') {
        const timelineRect = timelineRef.current.getBoundingClientRect();
        const dropX = e.clientX - timelineRect.left;
        const dropY = e.clientY - timelineRect.top;
        const dropTimePosition = (dropX / timelineRect.width) * VISIBLE_DURATION + timelineScroll;

        const trackHeight = 80;
        const dropTrackIndex = Math.floor(dropY / trackHeight);

        const newTrack = {
          id: Date.now(),
          clips: []
        };

        const defaultDuration = data.type === 'image' ? 5 : data.duration;
        newTrack.clips.push({
          ...data,
          clipId: Date.now(),
          start: dropTimePosition,
          duration: defaultDuration,
          width: `${(defaultDuration / VISIBLE_DURATION) * 100}%`
        });

        const newTracks = [...tracks];
        newTracks.splice(dropTrackIndex, 0, newTrack);
        setTracks(newTracks);
      }
    } catch (error) {
      console.error('Error processing dropped item:', error);
    }
  };

  const handleClipResize = (trackId, clipId, newDuration, newStart) => {
    setTracks(tracks.map(track => {
      if (track.id === trackId) {
        return {
          ...track,
          clips: track.clips.map(clip => {
            if (clip.clipId === clipId) {
              return {
                ...clip,
                duration: newDuration,
                start: newStart,
                width: `${(newDuration / VISIBLE_DURATION) * 100}%`
              };
            }
            return clip;
          })
        };
      }
      return track;
    }));
  };

  const handleClipHandleMouseDown = (e, trackId, clipId, isLeft) => {
    e.stopPropagation();
    const clip = tracks
      .find(t => t.id === trackId)
      ?.clips.find(c => c.clipId === clipId);

    if (!clip) return;

    const startX = e.clientX;
    const originalDuration = clip.duration;
    const originalStart = clip.start;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const timeDelta = (delta / timelineRef.current.clientWidth) * VISIBLE_DURATION;

      if (isLeft) {
        // Only adjust start time and duration, not height
        const newStart = Math.max(0, originalStart + timeDelta);
        const newDuration = Math.max(0.5, originalDuration - (newStart - originalStart));
        handleClipResize(trackId, clipId, newDuration, newStart);
      } else {
        // Only adjust duration, not height
        const newDuration = Math.max(0.5, originalDuration + timeDelta);
        handleClipResize(trackId, clipId, newDuration, originalStart);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Function to capture and display video frame
  const displayVideoFrame = (time) => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas size to match video dimensions while maintaining aspect ratio
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 200; // Fixed preview width
      canvas.height = canvas.width / aspectRatio;

      // Seek to the specific time
      video.currentTime = time;

      // Draw the frame once the video has seeked to the time
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      };
    }
  };

  // Handle clip selection
  const handleClipClick = (clip) => {
    setSelectedClip(clip);
    displayVideoFrame(clip.start);
  };

  // Handle preview window dragging
  const handlePreviewMouseDown = (e) => {
    if (e.target === canvasRef.current) {
      setIsDraggingPreview(true);
    }
  };

  const handlePreviewMouseMove = (e) => {
    if (isDraggingPreview) {
      setPreviewPosition({
        x: e.clientX - 100, // Center the preview under cursor
        y: e.clientY - 50
      });
    }
  };

  const handlePreviewMouseUp = () => {
    setIsDraggingPreview(false);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handlePreviewMouseMove);
    document.addEventListener('mouseup', handlePreviewMouseUp);
    return () => {
      document.removeEventListener('mousemove', handlePreviewMouseMove);
      document.removeEventListener('mouseup', handlePreviewMouseUp);
    };
  }, [isDraggingPreview]);

  // Handle canvas mouse interactions
  const handleCanvasMouseDown = (e) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Find clicked clip
    const clickedClip = activeClips.find(clip => {
      const pos = clip.position;
      return x >= pos.x && x <= pos.x + pos.width &&
        y >= pos.y && y <= pos.y + pos.height;
    });

    if (clickedClip) {
      setSelectedClipOverlay(clickedClip);

      // Check if clicking resize handle
      const handleSize = 20;
      const isOnHandle =
        x >= (clickedClip.position.x + clickedClip.position.width - handleSize) &&
        y >= (clickedClip.position.y + clickedClip.position.height - handleSize);

      if (isOnHandle) {
        setResizing(true);
        setResizeStart({
          width: clickedClip.position.width,
          height: clickedClip.position.height,
          x,
          y
        });
      } else {
        setIsDragging(true);
        setDragStart({
          x: x - clickedClip.position.x,
          y: y - clickedClip.position.y
        });
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if ((!isDragging && !resizing) || !selectedClipOverlay || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    setTracks(prevTracks => prevTracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.clipId === selectedClipOverlay.clipId) {
          if (resizing) {
            // Handle resizing
            const newWidth = Math.max(50, resizeStart.width + (x - resizeStart.x));
            const newHeight = Math.max(50, resizeStart.height + (y - resizeStart.y));
            return {
              ...clip,
              position: {
                ...clip.position,
                width: Math.min(newWidth, canvas.width - clip.position.x),
                height: Math.min(newHeight, canvas.height - clip.position.y)
              }
            };
          } else {
            // Handle dragging
            return {
              ...clip,
              position: {
                ...clip.position,
                x: Math.max(0, Math.min(canvas.width - clip.position.width, x - dragStart.x)),
                y: Math.max(0, Math.min(canvas.height - clip.position.height, y - dragStart.y))
              }
            };
          }
        }
        return clip;
      })
    })));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setResizing(false);
  };

  // Add event listeners for mouse move and up
  useEffect(() => {
    document.addEventListener('mousemove', handleCanvasMouseMove);
    document.addEventListener('mouseup', handleCanvasMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleCanvasMouseMove);
      document.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [isDragging, resizing, selectedClipOverlay, dragStart, resizeStart]);

  return (
    <div className="video-editor">
      <div className="preview-container">
        <div className="video-preview">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="preview-video"
              onLoadedMetadata={handleVideoLoad}
              onTimeUpdate={handleVideoTimeUpdate}
              onPlay={renderCanvas}
              onPause={() => {
                if (animationFrameRef.current) {
                  cancelAnimationFrame(animationFrameRef.current);
                }
              }}
            />
          ) : (
            <div className="video-upload-prompt">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                id="video-upload"
              />
              <label htmlFor="video-upload">Upload Video</label>
            </div>
          )}
        </div>

        {videoUrl && (
          <div className="canvas-preview">
            <canvas
              ref={canvasRef}
              width={videoSize.width}
              height={videoSize.height}
              className="preview-canvas"
              onMouseDown={handleCanvasMouseDown}
              style={{
                cursor: resizing ? 'nwse-resize' :
                  isDragging ? 'grabbing' :
                    'default'
              }}
            />
          </div>
        )}
      </div>

      <div className="editor-section">
        <div className="media-library">
          <h3>Media Library</h3>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaUpload}
            id="media-upload"
          />
          <div className="media-items">
            {mediaLibrary.map(item => (
              <div
                key={item.id}
                className="media-item"
                draggable
                onDragStart={(e) => handleClipDragStart(e, null, item)}
              >
                {item.type === 'video' ? (
                  <video src={item.url} />
                ) : (
                  <img src={item.url} alt={item.name} />
                )}
                <span>{item.name}</span>
                <span className="duration">{item.duration}s</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="timeline"
          ref={timelineRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleTimelineDrop}
        >
          {/* Timeline track */}
          {videoUrl && videoDuration > 0 && (
            <div className="track timeline-track">
              <div
                className="timeline-scroll"
                onClick={handleTimelineClick}
                onScroll={handleTimelineScroll}
              >
                <div
                  className="timeline-content"
                  style={{
                    width: `${(videoDuration / VISIBLE_DURATION) * 100}%`,
                    minWidth: '100%'
                  }}
                >
                  {/* Time markers */}
                  {Array.from({ length: Math.ceil(videoDuration) }, (_, i) => (
                    <div
                      key={i}
                      className="time-marker"
                      style={{
                        left: `${(i / videoDuration) * 100}%`
                      }}
                      data-time={formatTime(i)}
                    />
                  ))}
                  {/* Playhead needle */}
                  <div
                    className="playhead"
                    style={{
                      left: `${(currentTime / videoDuration) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Regular tracks */}
          {tracks.map(track => (
            <div
              key={track.id}
              className={`track ${track.isMainTrack ? 'main-track' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleTrackDrop(e, track.id)}
            >
              {track.clips.map(clip => (
                <div
                  key={clip.clipId}
                  className="clip"
                  style={{
                    width: clip.width,
                    left: `${(clip.start / VISIBLE_DURATION) * 100}%`
                  }}
                  draggable
                  onDragStart={(e) => handleClipDragStart(e, track.id, clip)}
                  onClick={() => handleClipClick(clip)}
                >
                  <div
                    className="clip-handle left"
                    onMouseDown={(e) => handleClipHandleMouseDown(e, track.id, clip.clipId, true)}
                  />
                  {clip.type === 'video' ? (
                    <video src={clip.url} />
                  ) : (
                    <img src={clip.url} alt={clip.name} />
                  )}
                  <div
                    className="clip-handle right"
                    onMouseDown={(e) => handleClipHandleMouseDown(e, track.id, clip.clipId, false)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper function to format time in MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default App;
