import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaUpload, FaImage, FaTrashAlt, FaPlus } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { throwIfNotOk } from '../utils/apiMessages';
import { useUser } from '../Contexts/UserContext';

const CreateAlbumModal = ({ isOpen, onClose, onCreateAlbum, currentUser, authToken, mode = 'create', albumData = null }) => {
    const { userInfo } = useUser();

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_IMAGE_ERROR = 'Image is too large. Please select an image less than 5MB.';

    const getDefaultPrivacy = () => {
        const hasFamily = Boolean(currentUser?.familyCode || userInfo?.familyCode);
        const isApproved = userInfo?.approveStatus === 'approved';
        return hasFamily && isApproved ? 'family' : 'public';
    };

    const getPreferredFamilyCode = () =>
        String(currentUser?.familyCode || userInfo?.familyCode || '').trim();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [privacy, setPrivacy] = useState(getDefaultPrivacy());
    const [familyCode, setFamilyCode] = useState('');

    // For new file uploads
    const [coverPhotoFile, setCoverPhotoFile] = useState(null);
    const [galleryPhotoFiles, setGalleryPhotoFiles] = useState([]);

    // For existing photos when in 'edit' mode
    const [currentCoverPhotoUrl, setCurrentCoverPhotoUrl] = useState(null);
    const [currentGalleryPhotos, setCurrentGalleryPhotos] = useState([]);
    const [removedImageIds, setRemovedImageIds] = useState([]);

    const [coverPhotoError, setCoverPhotoError] = useState('');
    const [galleryPhotosError, setGalleryPhotosError] = useState('');

    // Duplicate prevention state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const coverPhotoInputRef = useRef(null);
    const galleryPhotoInputRef = useRef(null);
    const getResolvedFamilyCode = () =>
        String(familyCode || currentUser?.familyCode || userInfo?.familyCode || '').trim();

    // Effect to initialize form fields when modal opens or mode/albumData changes

    useEffect(() => {
        if (!isOpen) return;

        if (mode === 'edit' && albumData) {
            setTitle(albumData.galleryTitle || albumData.title || '');
            setDescription(albumData.galleryDescription || albumData.description || '');
            setPrivacy(albumData.privacy === 'private' || albumData.privacy === 'family' ? 'family' : 'public');
            setFamilyCode(String(albumData.familyCode || getPreferredFamilyCode() || '').trim());
            setCoverPhotoFile(null);
            setGalleryPhotoFiles([]);
            setCurrentCoverPhotoUrl(albumData.coverPhoto || null);
            setCurrentGalleryPhotos(
                Array.isArray(albumData.images)
                    ? albumData.images
                    : Array.isArray(albumData.galleryPhotos)
                        ? albumData.galleryPhotos
                        : [],
            );
            setRemovedImageIds([]);
            setIsSubmitting(false);
            if (coverPhotoInputRef.current) coverPhotoInputRef.current.value = '';
            if (galleryPhotoInputRef.current) galleryPhotoInputRef.current.value = '';
            return;
        }

        setTitle('');
        setDescription('');
        setPrivacy(getDefaultPrivacy());
        setFamilyCode(getDefaultPrivacy() === 'family' ? getPreferredFamilyCode() : '');
        setCoverPhotoFile(null);
        setGalleryPhotoFiles([]);
        setCurrentCoverPhotoUrl(null);
        setCurrentGalleryPhotos([]);
        setRemovedImageIds([]);
        setIsSubmitting(false);
        setShowSuccess(false);
        if (coverPhotoInputRef.current) coverPhotoInputRef.current.value = '';
        if (galleryPhotoInputRef.current) galleryPhotoInputRef.current.value = '';
    }, [isOpen, mode, albumData, currentUser?.familyCode, userInfo?.familyCode, userInfo?.approveStatus]);

    useEffect(() => {
        if (!isOpen) return;
        if (privacy === 'family' && !familyCode.trim()) {
            const resolved = getResolvedFamilyCode();
            if (resolved) setFamilyCode(resolved);
        }
    }, [isOpen, privacy, familyCode, currentUser?.familyCode, userInfo?.familyCode]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPrivacy(getDefaultPrivacy());
        setFamilyCode('');
        setCoverPhotoFile(null);
        setGalleryPhotoFiles([]);
        setCurrentCoverPhotoUrl(null);
        setCurrentGalleryPhotos([]);
        setRemovedImageIds([]);
        setCoverPhotoError('');
        setGalleryPhotosError('');
        setIsSubmitting(false); // Reset submission state
        setShowSuccess(false);
        if (coverPhotoInputRef.current) coverPhotoInputRef.current.value = '';
        if (galleryPhotoInputRef.current) galleryPhotoInputRef.current.value = '';
    };

    const handleClose = () => {
        // Only allow close if not submitting
        if (!isSubmitting) {
            resetForm();
            onClose();
        }
    };

    const handleCoverPhotoChange = (e) => {
        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        if (!file) return;

        if (Number(file?.size || 0) > MAX_IMAGE_BYTES) {
            setCoverPhotoError(MAX_IMAGE_ERROR);
            setCoverPhotoFile(null);
            if (coverPhotoInputRef.current) coverPhotoInputRef.current.value = '';
            e.target.value = null;
            return;
        }

        if (coverPhotoError) setCoverPhotoError('');
        setCoverPhotoFile(file);
        setCurrentCoverPhotoUrl(null);
    };

    const handleRemoveCoverPhoto = () => {
        setCoverPhotoFile(null);
        setCurrentCoverPhotoUrl(null);
        setCoverPhotoError('');
        if (coverPhotoInputRef.current) coverPhotoInputRef.current.value = '';
    };

    const handleGalleryPhotosChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const validFiles = newFiles.filter((file) => Number(file?.size || 0) <= MAX_IMAGE_BYTES);
            const hasOversize = validFiles.length !== newFiles.length;

            if (hasOversize) {
                setGalleryPhotosError(MAX_IMAGE_ERROR);
            } else if (galleryPhotosError) {
                setGalleryPhotosError('');
            }

            if (validFiles.length > 0) {
                setGalleryPhotoFiles((prevFiles) => [...prevFiles, ...validFiles]);
            }
            e.target.value = null;
        }
    };

    const handleRemoveGalleryPhoto = (indexToRemove, isExisting = false) => {
        if (isExisting) {
            const photoToRemove = currentGalleryPhotos[indexToRemove];
            if (photoToRemove?.id) {
                setRemovedImageIds(prev => [...prev, photoToRemove.id]);
            }
            setCurrentGalleryPhotos(prev => 
                prev.filter((_, index) => index !== indexToRemove)
            );
        } else {
            setGalleryPhotoFiles(prev => 
                prev.filter((_, index) => index !== indexToRemove)
            );
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (isSubmitting) {
            console.log('Form submission already in progress...');
            return;
        }

        if (!authToken) {
            Swal.fire({
                icon: 'error',
                title: 'Not authenticated',
                text: 'Please sign in again and try updating the album.',
                confirmButtonColor: '#d33',
            });
            return;
        }

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Title',
                text: 'Album title is required!',
                confirmButtonColor: '#d33',
            });
            return;
        }

        const resolvedFamilyCode = getResolvedFamilyCode();
        if (privacy === 'family' && !resolvedFamilyCode) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Family Code',
                text: 'Family code is required for family-only albums. Please ensure you are part of a family.',
                confirmButtonColor: '#d33',
            });
            return;
        }
        if (privacy === 'family' && resolvedFamilyCode !== familyCode) {
            setFamilyCode(resolvedFamilyCode);
        }

        // Set submitting state to prevent duplicates
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('galleryTitle', trimmedTitle);
        formData.append('galleryDescription', description || '');
        formData.append('privacy', privacy === 'family' ? 'private' : privacy);

        const nextStatus = 1;
        if (Number.isFinite(Number(nextStatus))) {
            formData.append('status', String(nextStatus));
        }

        // Backend derives createdBy from the auth token; keep this only as a best-effort fallback.
        // Do NOT send empty string, otherwise backend validation (IsNumber) can fail with 400.
        const resolvedCreatedBy = Number(currentUser?.userId || userInfo?.userId);
        if (Number.isFinite(resolvedCreatedBy) && resolvedCreatedBy > 0) {
            formData.append('createdBy', String(resolvedCreatedBy));
        }
        
        if (privacy === 'family') {
            formData.append('familyCode', resolvedFamilyCode);
        }

        if (coverPhotoFile) {
            formData.append('coverPhoto', coverPhotoFile);
        } else if (mode === 'edit' && !currentCoverPhotoUrl && albumData?.coverPhoto) {
            formData.append('coverPhoto', 'null');
        }

        removedImageIds.forEach(id => {
            formData.append('removedImageIds', id.toString());
        });

        galleryPhotoFiles.forEach((file) => {
            formData.append('images', file);
        });

        let url = `${import.meta.env.VITE_API_BASE_URL}/gallery`;
        let method = 'POST';

        if (mode === 'edit' && albumData?.id) {
            url = `${import.meta.env.VITE_API_BASE_URL}/gallery/${albumData.id}`;
            method = 'PUT';
        } else if (mode === 'create') {
            url = `${import.meta.env.VITE_API_BASE_URL}/gallery/create`;
            method = 'POST';
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
                body: formData,
            });

            await throwIfNotOk(response, {
                fallback: `Unable to ${mode === 'create' ? 'create' : 'update'} the album. Please try again.`,
            });

            const result = await response.json().catch(() => ({}));

            console.log(`Album ${mode === 'create' ? 'Created' : 'Updated'}:`, result);

            // Wait for the parent to handle the update (refetch data)
            await onCreateAlbum(result);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                handleClose();
            }, 2000);

        } catch (err) {
            console.error(err);

            Swal.fire({
                icon: 'error',
                title: 'Can’t save album',
                text: err?.message || 'Something went wrong. Please try again.',
                confirmButtonColor: '#d33',
            });
        } finally {
            // Always reset submitting state
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto transform transition-all duration-300 scale-100 opacity-100 max-h-[90vh] overflow-hidden flex flex-col relative">
                {showSuccess && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 sm:p-6 text-center animate-fadeIn">
                        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl max-w-sm w-full border-4 border-green-500 transform animate-scaleIn">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-5 sm:mb-6 mx-auto shadow-lg animate-bounce">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-12 w-12 sm:h-14 sm:w-14 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>

                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
                                Success!
                            </h3>

                            <p className="text-gray-600 mb-6 text-base sm:text-lg">
                                {mode === 'create'
                                    ? 'Gallery created successfully!'
                                    : 'Gallery updated successfully!'}
                            </p>

                            <button
                                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 sm:px-10 py-3 rounded-full font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 active:scale-95"
                                onClick={() => {
                                    setShowSuccess(false);
                                    handleClose();
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="p-5 border-b bg-primary-500 border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">{mode === 'create' ? 'Create New Album' : 'Edit Album'}</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className={`bg-unset text-black-500 p-1.5 rounded-full transition-colors ${
                            isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                        }`}
                        title={isSubmitting ? "Cannot close while saving..." : "Close"}
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Main Content */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-grow">
                    {/* Album Title */}
                    <div>
                        <label htmlFor="albumTitle" className="block text-sm font-medium text-gray-700 mb-2">
                            Album Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="albumTitle"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isSubmitting}
                            className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-gray-800 placeholder-gray-400 transition-all ${
                                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            placeholder="E.g., Summer Vacation 2024"
                            required
                        />
                    </div>

                    {/* Album Description */}
                    <div>
                        <label htmlFor="albumDescription" className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="albumDescription"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSubmitting}
                            rows="3"
                            className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-gray-800 placeholder-gray-400 resize-none transition-all ${
                                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            placeholder="Describe your album..."
                        ></textarea>
                    </div>

                    {/* Privacy Setting */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Privacy
                        </label>
                        <div className="flex items-center space-x-4">
                            {userInfo?.approveStatus === 'approved' ? (
                                <>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                            name="privacy"
                                            value="family"
                                            checked={privacy === 'family'}
                                            onChange={(e) => {
                                                const nextValue = e.target.value;
                                                setPrivacy(nextValue);
                                                if (nextValue === 'family' && !familyCode.trim()) {
                                                    const resolved = getResolvedFamilyCode();
                                                    if (resolved) setFamilyCode(resolved);
                                                }
                                            }}
                                            disabled={isSubmitting}
                                        />
                                        <span className={`ml-2 text-gray-700 ${isSubmitting ? 'opacity-50' : ''}`}>Family</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                            name="privacy"
                                            value="public"
                                            checked={privacy === 'public'}
                                            onChange={(e) => setPrivacy(e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                        <span className={`ml-2 text-gray-700 ${isSubmitting ? 'opacity-50' : ''}`}>Public</span>
                                    </label>
                                </>
                            ) : (
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                        name="privacy"
                                        value="public"
                                        checked={true}
                                        disabled
                                    />
                                    <span className="ml-2 text-gray-700">Public (Only option for non-approved users)</span>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Family Code Input */}
                    {privacy === 'family' && (
                        <div>
                            <label htmlFor="familyCode" className="block text-sm font-medium text-gray-700 mb-2">
                                Family Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="familyCode"
                                value={familyCode}
                                onChange={(e) => setFamilyCode(e.target.value)}
                                disabled={isSubmitting}
                                className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-gray-800 placeholder-gray-400 transition-all ${
                                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                placeholder="Enter family code"
                                required={privacy === 'family'}
                                readOnly
                            />
                            <p className="mt-1 text-sm text-gray-500">Family code is automatically set based on your family membership.</p>
                        </div>
                    )}

                    {/* Cover Photo Upload */}
                    <div>
                        <label htmlFor="coverPhoto" className="block text-sm font-medium text-gray-700 mb-2">
                            Album Cover Photo (Optional)
                        </label>

                        {coverPhotoError ? (
                            <p className="text-red-600 text-xs mb-2">{coverPhotoError}</p>
                        ) : null}

                        <input
                            type="file"
                            id="coverPhoto"
                            ref={coverPhotoInputRef}
                            onChange={handleCoverPhotoChange}
                            accept="image/jpeg,image/png,image/jpg,image/gif"
                            disabled={isSubmitting}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => coverPhotoInputRef.current.click()}
                            disabled={isSubmitting}
                            className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-lg transition-colors text-gray-700 flex items-center justify-center ${
                                isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                            }`}
                        >
                            <FaUpload className="mr-2 h-5 w-5 text-gray-500" />
                            {currentCoverPhotoUrl || coverPhotoFile ? 'Change Cover Photo' : 'Choose Cover Photo'}
                        </button>
                        {(coverPhotoFile || currentCoverPhotoUrl) && (
                            <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                                <img
                                    src={coverPhotoFile ? URL.createObjectURL(coverPhotoFile) : currentCoverPhotoUrl}
                                    alt="Cover Preview"
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveCoverPhoto}
                                    disabled={isSubmitting}
                                    className={`absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 transition-colors ${
                                        isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                                    }`}
                                    title="Remove cover photo"
                                >
                                    <FaTimes size={12} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Gallery Photos Upload Section */}
                    <div>
                        <label htmlFor="galleryPhotos" className="block text-sm font-medium text-gray-700 mb-2">
                            Add Photos to Album
                        </label>

                        {galleryPhotosError ? (
                            <p className="text-red-600 text-xs mb-2">{galleryPhotosError}</p>
                        ) : null}

                        <input
                            type="file"
                            id="galleryPhotos"
                            ref={galleryPhotoInputRef}
                            onChange={handleGalleryPhotosChange}
                            accept="image/jpeg,image/png,image/jpg,image/gif"
                            multiple
                            disabled={isSubmitting}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => galleryPhotoInputRef.current.click()}
                            disabled={isSubmitting}
                            className={`w-full p-3 bg-primary-50 border border-primary-200 rounded-lg transition-colors text-primary-700 flex items-center justify-center ${
                                isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-100'
                            }`}
                        >
                            <FaPlus className="mr-2 h-5 w-5" />
                            Add More Photos
                        </button>

                        {/* Photo Previews */}
                        {(currentGalleryPhotos.length > 0 || galleryPhotoFiles.length > 0) && (
                            <div className="mt-4 grid grid-cols-3 gap-2">
                                {/* Existing photos */}
                                {currentGalleryPhotos.map((photo, index) => (
                                    <div key={`existing-${photo.id || index}`} className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                        <img
                                            src={photo.url}
                                            alt={`Existing gallery photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveGalleryPhoto(index, true)}
                                                disabled={isSubmitting}
                                                className={`bg-red-500 text-white rounded-full p-1 transition-colors ${
                                                    isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                                                }`}
                                                title="Remove photo"
                                            >
                                                <FaTrashAlt size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {/* Newly added photos */}
                                {galleryPhotoFiles.map((file, index) => (
                                    <div key={`new-${index}`} className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={`New gallery photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveGalleryPhoto(index, false)}
                                                disabled={isSubmitting}
                                                className={`bg-red-500 text-white rounded-full p-1 transition-colors ${
                                                    isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                                                }`}
                                                title="Remove photo"
                                            >
                                                <FaTrashAlt size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(currentGalleryPhotos.length === 0 && galleryPhotoFiles.length === 0) && (
                            <p className="mt-2 text-sm text-gray-500 italic">No photos selected for the album yet.</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className={`px-4 py-2 rounded-lg border bg-white border-gray-300 text-gray-700 font-medium transition-colors ${
                                isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || isSubmitting}
                            className={`px-4 py-2 rounded-lg font-medium text-white transition-all flex items-center gap-1 ${
                                title.trim() && !isSubmitting
                                    ? 'bg-secondary-500 hover:bg-secondary-600 shadow-md'
                                    : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-1"></div>
                                    {mode === 'create' ? 'Creating...' : 'Updating...'}
                                </>
                            ) : (
                                mode === 'create' ? 'Create Album' : 'Update Album'
                            )}
                        </button>
                    </div>

                    {/* Loading overlay when submitting */}
                    {isSubmitting && (
                        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10">
                            <div className="bg-white rounded-lg p-4 shadow-lg flex items-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent mr-3"></div>
                                <span className="text-gray-700 font-medium">
                                    {mode === 'create' ? 'Creating album...' : 'Updating album...'}
                                </span>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default CreateAlbumModal;