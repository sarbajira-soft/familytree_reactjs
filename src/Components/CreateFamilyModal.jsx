import React, { useState, useEffect  } from 'react';
import { FiX, FiUser, FiInfo, FiImage, FiHash } from 'react-icons/fi';
import Swal from 'sweetalert2';

const CreateFamilyModal = ({ isOpen, onClose, token, onFamilyCreated, mode = "create", initialData = null }) => {
    const [familyName, setFamilyName] = useState(initialData?.familyName || '');
    const [familyBio, setFamilyBio] = useState(initialData?.familyBio || '');
    const [familyPhoto, setFamilyPhoto] = useState(null);
    const [preview, setPreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [familyNameError, setFamilyNameError] = useState('');
    const [familyBioError, setFamilyBioError] = useState('');
    const [familyPhotoError, setFamilyPhotoError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);

    const MAX_FAMILY_NAME_LENGTH = 100;
    const MAX_FAMILY_BIO_LENGTH = 250;

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
    ]);

    const generateFamilyCode = () => `FAM${Date.now().toString().slice(-6)}`;

    const [familyCode, setFamilyCode] = useState(() =>
    mode === 'edit' ? initialData?.familyCode || '' : generateFamilyCode()
    );

    const completeSuccessFlow = (data) => {
      setShowSuccess(false);
      setSuccessData(null);

      if (mode === 'edit') {
        onFamilyCreated(data);
        onClose();
        window.location.reload();
        return;
      }

      onFamilyCreated(data);
      onClose();
      window.location.href = '/family-tree';
    };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFamilyPhoto(null);
      setPreview('');
      if (familyPhotoError) setFamilyPhotoError('');
      return;
    }

    const nextType = String(file?.type || '');
    const isImage = nextType.startsWith('image/');
    const isAllowed = ALLOWED_IMAGE_TYPES.has(nextType);

    if (!isImage || !isAllowed) {
      setFamilyPhoto(null);
      setPreview('');
      setFamilyPhotoError('Only image files (jpeg, jpg, png, gif) are allowed.');
      try {
        const input = document.getElementById('family-image-input');
        if (input) input.value = '';
      } catch {}
      return;
    }

    if (Number(file?.size || 0) > MAX_IMAGE_BYTES) {
      setFamilyPhoto(null);
      setPreview('');
      setFamilyPhotoError('Image size should be less than 5MB.');
      try {
        const input = document.getElementById('family-image-input');
        if (input) input.value = '';
      } catch {}
      return;
    }

    if (familyPhotoError) setFamilyPhotoError('');
    setFamilyPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const nameTrimmed = (familyName || '').trim();
        const bioTrimmed = (familyBio || '').trim();

        if (!nameTrimmed) {
          setFamilyNameError('Family Name cannot be empty.');
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Family Name',
            text: 'Family Name cannot be empty.',
          });
          return;
        }

        if (familyNameError) setFamilyNameError('');

        if (nameTrimmed.length > MAX_FAMILY_NAME_LENGTH) {
          const msg = `Family Name must be ${MAX_FAMILY_NAME_LENGTH} characters or less.`;
          setFamilyNameError(msg);
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Family Name',
            text: msg,
          });
          return;
        }

        if (!bioTrimmed) {
          setFamilyBioError('Family Bio cannot be empty.');
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Family Bio',
            text: 'Family Bio cannot be empty.',
          });
          return;
        }

        if (familyBioError) setFamilyBioError('');

        if (bioTrimmed.length > MAX_FAMILY_BIO_LENGTH) {
          const msg = `Family Bio must be ${MAX_FAMILY_BIO_LENGTH} characters or less.`;
          setFamilyBioError(msg);
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Family Bio',
            text: msg,
          });
          return;
        }

        const formData = new FormData();
        formData.append('familyName', nameTrimmed);
        formData.append('familyBio', bioTrimmed);
        formData.append('familyCode', familyCode);
        if (familyPhoto) formData.append('familyPhoto', familyPhoto);

        const endpoint =
            mode === 'edit'
            ? `${import.meta.env.VITE_API_BASE_URL}/family/${initialData.id}`
            : mode === 'createSpouseFamily'
              ? `${import.meta.env.VITE_API_BASE_URL}/family/create-spouse-family`
              : `${import.meta.env.VITE_API_BASE_URL}/family/create`;

        setLoading(true);
        try {
            const res = await fetch(endpoint, {
            method: mode === 'edit' ? 'PUT' : 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
            });

            // Debug: log status and response
            const text = await res.text();
            console.log('Response status:', res.status);
            console.log('Response text:', text);

            if (!res.ok) {
                let errorMsg = 'Failed to submit form';
                try {
                    const errorData = JSON.parse(text);
                    if (errorData && errorData.message) errorMsg = errorData.message;
                } catch {}
                throw new Error(errorMsg);
            }

            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                data = {};
            }

            if (mode !== 'edit') {
              if (data && data.accessToken) {
                localStorage.setItem('access_token', data.accessToken);
              }

              // If creating (not editing), update localStorage userInfo with new familyCode
              const createdFamilyCode = data?.data?.familyCode || data?.familyCode || null;
              if (createdFamilyCode) {
                let userInfo = null;
                try {
                  userInfo = JSON.parse(localStorage.getItem('userInfo'));
                } catch {}
                if (userInfo) {
                  userInfo.familyCode = createdFamilyCode;
                  localStorage.setItem('userInfo', JSON.stringify(userInfo));
                }

                // Automatically initialize and save the family tree with the current user as root
                try {
                    const treeEndpoint = `${import.meta.env.VITE_API_BASE_URL}/family-tree/save`;
                    const treeData = {
                        familyCode: createdFamilyCode,
                        people: [{
                            id: "root",
                            name: userInfo?.name || "Root",
                            gender: userInfo?.gender || "male",
                            age: userInfo?.age || 30,
                            img: userInfo?.profileUrl || "",
                            memberId: userInfo?.userId,
                            generation: 0,
                            position: 0,
                            spouses: [],
                            parents: [],
                            children: []
                        }]
                    };

                    await fetch(treeEndpoint, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify(treeData),
                    });
                    console.log('Initial family tree saved automatically');
                } catch (treeErr) {
                    console.error('Failed to auto-save initial family tree:', treeErr);
                }
              }
            }

            setSuccessData(data);
            setShowSuccess(true);
            setTimeout(() => {
              completeSuccessFlow(data);
            }, 2000);
        } catch (err) {
            Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: err.message || 'Failed to submit form',
            });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialData && mode === 'edit') {
            setFamilyName(initialData.familyName || '');
            setFamilyBio(initialData.familyBio || '');
            setPreview(initialData.familyPhotoUrl || '');
        }
    }, [initialData]);

    if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 font-inter">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-hidden flex flex-col">
        {showSuccess && (
          <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 sm:p-6 text-center animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl max-w-sm w-full border-4 border-green-500 transform animate-scaleIn">
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

              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-3">
                Success!
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-6 text-base sm:text-lg">
                {mode === 'edit' ? 'Family updated successfully!' : 'Family created successfully!'}
              </p>

              <button
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 sm:px-10 py-3 rounded-full font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 active:scale-95"
                onClick={() => completeSuccessFlow(successData)}
              >
                OK
              </button>
            </div>
          </div>
        )}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-primary-500">
          <h2 className="text-lg sm:text-2xl font-bold text-white">
            {mode === 'edit' ? 'Edit Family' : 'Create Family'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 bg-white hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all active:scale-95"
            title="Close"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col p-6 overflow-y-auto">
          <div>
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">Family Name</label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => {
                const next = e.target.value;
                setFamilyName(next);
                const trimmed = String(next || '').trim();
                if (!trimmed) {
                  setFamilyNameError('Family Name cannot be empty.');
                } else if (trimmed.length > MAX_FAMILY_NAME_LENGTH) {
                  setFamilyNameError(`Family Name must be ${MAX_FAMILY_NAME_LENGTH} characters or less.`);
                } else if (familyNameError) {
                  setFamilyNameError('');
                }
              }}
              maxLength={MAX_FAMILY_NAME_LENGTH}
              required
              className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-gray-400 rounded-lg px-4 py-2 focus:ring-primary-500 focus:outline-none"
              placeholder="The Singhs"
            />
            {familyNameError ? (
              <p className="text-red-600 text-xs mt-1">{familyNameError}</p>
            ) : null}
          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">Family Bio</label>
            <textarea
              value={familyBio}
              onChange={(e) => {
                const next = e.target.value;
                setFamilyBio(next);
                const trimmed = String(next || '').trim();
                if (!trimmed) {
                  setFamilyBioError('Family Bio cannot be empty.');
                } else if (trimmed.length > MAX_FAMILY_BIO_LENGTH) {
                  setFamilyBioError(`Family Bio must be ${MAX_FAMILY_BIO_LENGTH} characters or less.`);
                } else if (familyBioError) {
                  setFamilyBioError('');
                }
              }}
              rows={3}
              maxLength={MAX_FAMILY_BIO_LENGTH}
              required
              className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-gray-400 rounded-lg px-4 py-2 focus:ring-primary-500 focus:outline-none"
              placeholder="A united and respected family from Chennai."
            />
            {familyBioError ? (
              <p className="text-red-600 text-xs mt-1">{familyBioError}</p>
            ) : null}
          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">Family Code</label>
            <input
                type="text"
                value={familyCode}
                readOnly
                className="w-full border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-not-allowed"
                placeholder="FAM001122"
                />

          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">Family Photo (optional)</label>
            <div
              className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex items-center justify-center cursor-pointer dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => document.getElementById('family-image-input').click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-xl" />
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <FiImage size={30} className="mx-auto mb-2" />
                  <p>Click to upload photo</p>
                </div>
              )}
              <input
                id="family-image-input"
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
            {familyPhotoError ? (
              <p className="text-red-600 text-xs mt-1">{familyPhotoError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary-500 hover:bg-secondary-600 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {loading ? (mode === 'edit' ? 'Updating...' : 'Creating...') : (mode === 'edit' ? 'Update Family' : 'Create Family')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateFamilyModal;
