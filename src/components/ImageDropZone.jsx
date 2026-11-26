/**
 * ImageDropZone.jsx
 * Composant multi-méthode pour l'insertion et la gestion d'images dans l'éditeur de cours.
 * Supporte : Clipboard Paste (Ctrl+V), Drag & Drop, File Upload, Camera Capture.
 * Toutes les images sont converties en Data URL (base64) pour stockage inline garanti.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Image as ImageIcon, X, Check } from 'lucide-react';

/**
 * Reads a File/Blob as a base64 Data URL.
 * @param {File|Blob} file
 * @returns {Promise<string>} Data URL string
 */
export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/**
 * Extracts image file from a ClipboardEvent or DataTransfer.
 * Returns the first image file found, or null.
 */
export const extractImageFile = (dataTransfer) => {
  if (!dataTransfer) return null;
  
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.type.startsWith('image/')) {
        return item.getAsFile();
      }
    }
  }
  
  if (dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      if (dataTransfer.files[i].type.startsWith('image/')) {
        return dataTransfer.files[i];
      }
    }
  }
  
  return null;
};

/**
 * ImageDropZone — Multi-method image insertion component.
 */
export default function ImageDropZone({ 
  onImageInsert, 
  compact = false, 
  showCamera = true, 
  children 
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [flashMessage, setFlashMessage] = useState('');
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const dropRef = useRef(null);

  const showFlash = useCallback((msg) => {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(''), 2500);
  }, []);

  const processImage = useCallback(async (file, source = 'upload') => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      if (onImageInsert) {
        onImageInsert(dataUrl, `Figure (${source})`);
      }
      showFlash(`✓ Image insérée avec succès (${source})`);
      setTimeout(() => setPreviewUrl(null), 2000);
    } catch (err) {
      console.error('[ImageDropZone] Error processing image:', err);
    }
  }, [onImageInsert, showFlash]);

  // 1. CLIPBOARD PASTE (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e) => {
      const imageFile = extractImageFile(e.clipboardData);
      if (imageFile) {
        e.preventDefault();
        e.stopPropagation();
        processImage(imageFile, 'Collage');
      }
    };

    const target = dropRef.current || document;
    target.addEventListener('paste', handlePaste);
    return () => target.removeEventListener('paste', handlePaste);
  }, [processImage]);

  // 2. DRAG & DROP
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const imageFile = extractImageFile(e.dataTransfer);
    if (imageFile) {
      processImage(imageFile, 'Glisser-déposer');
    }
  }, [processImage]);

  // 3. FILE UPLOAD
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file, 'Fichier');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processImage]);

  // 4. CAMERA CAPTURE
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      streamRef.current = stream;
      setIsCapturing(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('[Camera] autoplay:', e));
        }
      }, 100);
    } catch (err) {
      console.error('[Camera] Access denied:', err);
      showFlash('❌ Impossible d’accéder à la caméra');
    }
  }, [showFlash]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/png', 0.92);
    if (onImageInsert) {
      onImageInsert(dataUrl, 'Photo caméra');
    }
    showFlash('📸 Photo capturée et insérée');
    stopCamera();
  }, [onImageInsert, showFlash, stopCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
      onChange={handleFileSelect}
      style={{ display: 'none' }}
    />
  );

  // Camera Overlay
  if (isCapturing) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '1rem'
      }}>
        <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '70vh', borderRadius: '16px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
          
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px dashed rgba(255,255,255,0.3)',
            borderRadius: '16px',
            pointerEvents: 'none'
          }} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={capturePhoto}
            style={{
              width: 68, height: 68, borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              border: '4px solid rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 30px rgba(239,68,68,0.5)'
            }}
          >
            <Camera size={28} color="#fff" />
          </button>
          <button
            type="button"
            onClick={stopCamera}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.4)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600 }}>
          📷 Orientez la caméra vers la figure géométrique puis appuyez sur capturer
        </p>
      </div>
    );
  }

  // Compact Mode (inline buttons)
  if (compact) {
    return (
      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
        {fileInput}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px',
            padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700,
            color: '#7c3aed', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
          }}
          title="Importer une image (ou Ctrl+V pour coller)"
        >
          <Upload size={12} /> 📸 + Image
        </button>

        {showCamera && (
          <button
            type="button"
            onClick={startCamera}
            style={{
              background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px',
              padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700,
              color: '#0891b2', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
            }}
            title="Prendre une photo avec la caméra"
          >
            <Camera size={12} /> 📷 Caméra
          </button>
        )}

        {flashMessage && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>
            {flashMessage}
          </span>
        )}
      </div>
    );
  }

  // Full Wrapper Mode
  return (
    <div
      ref={dropRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative', width: '100%' }}
    >
      {fileInput}
      
      {/* Drag Overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(124, 58, 237, 0.12)',
          border: '3px dashed #7c3aed',
          borderRadius: '12px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem',
          backdropFilter: 'blur(3px)',
          pointerEvents: 'none'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 25px rgba(124,58,237,0.5)'
          }}>
            <ImageIcon size={28} color="#fff" />
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: '#7c3aed', margin: 0 }}>
            Déposez l&apos;image ici pour l&apos;insérer 📸
          </p>
        </div>
      )}

      {/* Flash Toast */}
      {flashMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff', fontWeight: 800, fontSize: '0.85rem',
          padding: '0.6rem 1.25rem', borderRadius: '10px',
          boxShadow: '0 8px 25px rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.4rem'
        }}>
          <Check size={16} />
          {flashMessage}
        </div>
      )}

      {/* Preview of inserted image */}
      {previewUrl && (
        <div style={{
          position: 'fixed', bottom: '4.5rem', right: '1.5rem',
          zIndex: 9998,
          background: '#fff', borderRadius: '10px', padding: '0.4rem',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          border: '2px solid #10b981'
        }}>
          <img src={previewUrl} alt="Preview" style={{
            width: '100px', height: '70px', objectFit: 'contain',
            borderRadius: '6px', display: 'block'
          }} />
        </div>
      )}

      {children}
    </div>
  );
}
