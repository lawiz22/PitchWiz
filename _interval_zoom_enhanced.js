
// Update mouse handler to include horizontal zoom
const canvas = document.getElementById('intervalCanvas');
if (canvas) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startVZoom = 1.0;
    let startHZoom = 1.0;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        if (intervalState.visualizer) {
            startVZoom = intervalState.visualizer.zoomLevel || 1.0;
            startHZoom = intervalState.visualizer.horizontalZoom || 1.0;
        }
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !intervalState.visualizer) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Horizontal = H-Zoom
        const hZoomDelta = deltaX * 0.003;
        const newHZoom = Math.max(0.5, Math.min(3.0, startHZoom + hZoomDelta));
        intervalState.visualizer.horizontalZoom = newHZoom;

        // Vertical = V-Zoom
        const vZoomDelta = -deltaY * 0.005;
        const newVZoom = Math.max(0.5, Math.min(3.0, startVZoom + vZoomDelta));
        intervalState.visualizer.setZoom(newVZoom);
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.style.cursor = 'grab';
    console.log('âœ Enhanced drag controls: Left/Right = H-Zoom, Up/Down = V-Zoom');
}
