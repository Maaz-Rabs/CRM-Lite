import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Film } from 'lucide-react';
import './MediaUploader.css';

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const isImage = (file) => {
  if (file.type) return file.type.startsWith('image/');
  const ext = (file.name || '').toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(ext);
};

const isVideo = (file) => {
  if (file.type) return file.type.startsWith('video/');
  const ext = (file.name || '').toLowerCase();
  return /\.(mp4|webm|mov|avi|mkv)$/.test(ext);
};

const MediaUploader = ({
  files = [],
  onFilesChange,
  onRemove,
  accept = 'image/*,application/pdf,video/*',
  maxFiles = 20,
  label,
}) => {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (newFiles) => {
    const fileList = Array.from(newFiles);
    const remaining = maxFiles - files.length;
    if (remaining <= 0) return;
    const toAdd = fileList.slice(0, remaining);
    if (onFilesChange) onFilesChange([...files, ...toAdd]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleRemove = (index) => {
    if (onRemove) onRemove(index);
    else if (onFilesChange) onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="media-uploader">
      {label && <span className="media-uploader__label">{label}</span>}

      <div
        className={`media-uploader__dropzone ${dragActive ? 'media-uploader__dropzone--active' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="media-uploader__dropzone-icon">
          <Upload size={20} />
        </div>
        <span className="media-uploader__dropzone-text">
          Drop files here or click to browse
        </span>
        <span className="media-uploader__dropzone-hint">
          Images, PDFs, Videos &middot; Max {maxFiles} files
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
      </div>

      {files.length > 0 && (
        <div className="media-uploader__files">
          {files.map((file, i) => {
            const fileObj = file instanceof File ? file : null;
            const name = fileObj ? fileObj.name : (file.name || file.original_name || `File ${i + 1}`);
            const size = fileObj ? fileObj.size : file.size;
            const previewUrl = fileObj
              ? (isImage(fileObj) ? URL.createObjectURL(fileObj) : null)
              : (file.url || file.file_url || null);

            return (
              <div className="media-uploader__file" key={i}>
                {previewUrl && (isImage(file) || (fileObj && isImage(fileObj))) ? (
                  <img className="media-uploader__preview" src={previewUrl} alt={name} />
                ) : isVideo(file) || (fileObj && isVideo(fileObj)) ? (
                  <div className="media-uploader__file-icon"><Film size={28} /></div>
                ) : (
                  <div className="media-uploader__file-icon"><FileText size={28} /></div>
                )}
                <div className="media-uploader__file-info">
                  <span className="media-uploader__file-name" title={name}>{name}</span>
                  {size ? <span className="media-uploader__file-size">{formatSize(size)}</span> : null}
                </div>
                <button
                  type="button"
                  className="media-uploader__file-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
