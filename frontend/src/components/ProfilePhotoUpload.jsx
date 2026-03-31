import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Loader2, Check, X } from 'lucide-react';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import UserAvatar from './UserAvatar';

/**
 * ProfilePhotoUpload - Component for uploading/managing profile photos
 * @param {string} currentPhotoUrl - Current profile photo URL
 * @param {string} userName - User's name for avatar fallback
 * @param {string} token - Auth token
 * @param {function} onPhotoChange - Callback when photo changes
 */
const ProfilePhotoUpload = ({ 
  currentPhotoUrl, 
  userName,
  token,
  onPhotoChange,
  size = 'xl'
}) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type de fichier non autorisé. Utilisez: JPG, PNG ou WebP');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Fichier trop volumineux. Maximum: 2MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      setShowConfirm(true);
    };
    reader.readAsDataURL(file);
  };

  const confirmUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(
        `${API_URL}/api/user/upload-profile-image`,
        formData,
        { 
          headers: { 
            ...headers,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Photo de profil mise à jour!');
      
      // Notify parent
      if (onPhotoChange) {
        onPhotoChange(res.data.profile_image_url);
      }
      
      // Reset state
      setPreviewUrl(null);
      setShowConfirm(false);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const cancelUpload = () => {
    setPreviewUrl(null);
    setShowConfirm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!currentPhotoUrl) return;

    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/user/profile-image`, { headers });
      toast.success('Photo de profil supprimée');
      
      if (onPhotoChange) {
        onPhotoChange(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar display */}
      <div className="relative group">
        {showConfirm && previewUrl ? (
          // Show preview
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-500">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          // Show current avatar
          <UserAvatar 
            photoUrl={currentPhotoUrl}
            name={userName}
            size="2xl"
            showBorder={true}
          />
        )}

        {/* Upload overlay */}
        {!showConfirm && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          >
            <Camera className="w-8 h-8 text-white" />
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Confirmation buttons */}
      {showConfirm && (
        <div className="flex gap-2">
          <button
            onClick={confirmUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Confirmer
          </button>
          <button
            onClick={cancelUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Annuler
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!showConfirm && (
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {currentPhotoUrl ? 'Changer' : 'Ajouter'}
          </button>
          
          {currentPhotoUrl && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Supprimer
            </button>
          )}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-slate-500 text-center">
        JPG, PNG ou WebP • Max 2MB
      </p>
    </div>
  );
};

export default ProfilePhotoUpload;
