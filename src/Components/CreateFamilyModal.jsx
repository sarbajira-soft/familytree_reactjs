import React, { useState, useEffect  } from 'react';
import { FiX, FiUser, FiInfo, FiImage, FiHash } from 'react-icons/fi';
import Swal from 'sweetalert2';

const CreateFamilyModal = ({ isOpen, onClose, token, onFamilyCreated, mode = "create", initialData = null }) => {
    const [familyName, setFamilyName] = useState(initialData?.familyName || '');
    const [familyBio, setFamilyBio] = useState(initialData?.familyBio || '');
    const [familyPhoto, setFamilyPhoto] = useState(null);
    const [preview, setPreview] = useState('');
    const [loading, setLoading] = useState(false);

    const generateFamilyCode = () => `FAM${Date.now().toString().slice(-6)}`;

    const [familyCode, setFamilyCode] = useState(() =>
    mode === 'edit' ? initialData?.familyCode || '' : generateFamilyCode()
    );

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFamilyPhoto(file);
      setPreview(URL.createObjectURL(file));
    } else {
      setFamilyPhoto(null);
      setPreview('');
    }
  };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const nameTrimmed = (familyName || '').trim();
        const bioTrimmed = (familyBio || '').trim();

        if (!nameTrimmed) {
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Family Name',
            text: 'Family Name cannot be empty.',
          });
          return;
        }

        if (!bioTrimmed) {
          await Swal.fire({
            icon: 'warning',
            title: 'Invalid Family Bio',
            text: 'Family Bio cannot be empty.',
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

            if (mode === 'edit') {
              Swal.fire({
                icon: 'success',
                title: 'Family updated!',
                showConfirmButton: true,
              }).then(() => {
                onFamilyCreated(data);
                onClose();
                window.location.reload();
              });
            } else {
              Swal.fire({
                icon: 'success',
                title: 'Family created!',
                showConfirmButton: false,
                timer: 1500,
              });

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
              }
              onFamilyCreated(data);
              onClose();
              window.location.href = '/my-family';
            }
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="bg-unset absolute top-4 right-4 text-gray-500 hover:text-gray-700">
          <FiX size={24} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            {mode === 'edit' ? 'Edit Family' : 'Create Family'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
          <div>
            <label className="block mb-1 font-medium text-gray-700">Family Name</label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2 focus:ring-primary-500 focus:outline-none"
              placeholder="The Singhs"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700">Family Bio</label>
            <textarea
              value={familyBio}
              onChange={(e) => setFamilyBio(e.target.value)}
              rows={3}
              required
              className="w-full border rounded-lg px-4 py-2 focus:ring-primary-500 focus:outline-none"
              placeholder="A united and respected family from Chennai."
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700">Family Code</label>
            <input
                type="text"
                value={familyCode}
                readOnly
                className="w-full border rounded-lg px-4 py-2 bg-gray-100 text-gray-700 focus:outline-none cursor-not-allowed"
                placeholder="FAM001122"
                />

          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700">Family Photo (optional)</label>
            <div
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer"
              onClick={() => document.getElementById('family-image-input').click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-xl" />
              ) : (
                <div className="text-center text-gray-500">
                  <FiImage size={30} className="mx-auto mb-2" />
                  <p>Click to upload photo</p>
                </div>
              )}
              <input
                id="family-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {loading ? (mode === 'edit' ? 'Updating...' : 'Creating...') : (mode === 'edit' ? 'Update Family' : 'Create Family')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateFamilyModal;
