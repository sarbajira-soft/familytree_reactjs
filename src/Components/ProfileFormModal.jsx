import React, { useState, useEffect, useRef } from 'react';
import PhoneInput from 'react-phone-input-2';
import Swal from 'sweetalert2';
import { FiArrowLeft } from 'react-icons/fi';
import { useUser } from '../Contexts/UserContext';

const INDIAN_RELIGIONS = [
  'Hindu',
  'Muslim',
  'Christian',
  'Sikh',
  'Buddhist',
  'Jain',
  'Zoroastrian (Parsi)',
];

const INDIAN_LANGUAGES = [
  'Tamil',
  'Hindi',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Marathi',
  'Gujarati',
  'Bengali',
  'Punjabi',
  'Urdu',
  'Odia',
  'Assamese',
  'English',
];

const ProfileFormModal = ({
  isOpen,
  onClose,
  onAddMember,
  onUpdateProfile,
  mode = 'add',
  memberData = {},
  variant = 'modal',
}) => {
  const mobileRef = useRef(null);
  const profileFileInputRef = useRef(null);
  const { userInfo, userLoading } = useUser();
  
  // Define initial form data structure
  const initialFormData = {
    // Account Information
    email: '',
    mobile: '', // For login (separate from contact number)
    countryCode: '+91', // For login mobile
    password: '', // Only for user creation/password change
    status: '1', // Default to Active (1)
    role: '1', // Default to Member (1)
    
    // Personal Information
    firstName: '',
    lastName: '',
    profileImageUrl: '',
    profileImageFile: null,
    removeProfile: false,
    gender: '',
    dob: '',
    
    // Contact Information
    address: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    
    // Family Information
    maritalStatus: '',
    marriageDate: '',
    spouseName: '',
    childrenCount: 0,
    childrenNames: [],
    fatherName: '',
    motherName: '',
    familyCode: '',
    
    // Cultural Information
    religionId: '',
    religionOther: '',
    languageId: '',
    languageOther: '',
    caste: '',
    gothramId: '',
    gothramOther: '',
    kuladevata: '',
    region: '',
    
    // Additional Information
    hobbies: '',
    likes: '',
    dislikes: '',
    favoriteFoods: '',
    bio: '',
    
    // Calculated fields
    age: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const firstErrorRef = useRef(null);
  const lastMemberDataRef = useRef({});
  const hasInitializedForm = useRef(false);
  const [apiError, setApiError] = useState(null);
  const errorRef = useRef(null);

  // State for dropdown data
  const [dropdownData, setDropdownData] = useState({
    languages: [],
    religions: [],
    gothrams: [],
    loading: true,
    error: null
  });

  // Check if current user can edit account settings (role 2 or 3 - Admin/Superadmin)
  const canEditAccountSettings = userInfo && (userInfo.role === 2 || userInfo.role === 3);

  // Check if this is the current user's profile being edited
  const isCurrentUserProfile = mode === 'edit-profile' && userInfo && userInfo.userId === (formData.userId || userInfo.userId);

  useEffect(() => {
    if (apiError && errorRef.current) {
      // Focus on error message and scroll to it
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a small delay to ensure the scroll completes before focusing
      setTimeout(() => {
        errorRef.current.focus();
      }, 300);
    }
  }, [apiError]);

  // Effect to populate form data when modal opens or mode changes
  useEffect(() => {
    if (isOpen) {
      if (!hasInitializedForm.current) {
        if (mode === 'edit-profile' || mode === 'edit-member') {
          const sourceDataRaw = mode === 'edit-profile' ? userInfo : memberData;

          if (!sourceDataRaw) return;
          
          // Handle children names from either raw.childrenNames or individual childName fields
          let childrenNames = [];
          if (sourceDataRaw.childrenNames) {
            if (Array.isArray(sourceDataRaw.childrenNames)) {
              childrenNames = [...sourceDataRaw.childrenNames];
            } else if (typeof sourceDataRaw.childrenNames === 'string') {
              try {
                childrenNames = JSON.parse(sourceDataRaw.childrenNames);
              } catch {
                childrenNames = [];
              }
            }
          } else if (sourceDataRaw.childName0) {
            // Handle case where children are stored as individual fields (childName0, etc.)
            const childCount = sourceDataRaw.childrenCount || 1;
            for (let i = 0; i < childCount; i++) {
              if (sourceDataRaw[`childName${i}`]) {
                childrenNames.push(sourceDataRaw[`childName${i}`]);
              }
            }
          }

          // Parse contact number
          let countryCode = '+91';
          let mobile = '';

          if (sourceDataRaw.countryCode) {
            countryCode = sourceDataRaw.countryCode;
          }
          if (sourceDataRaw.mobile) {
            mobile = sourceDataRaw.mobile;
          } else if (sourceDataRaw.contactNumber) {
            // Fallback to contactNumber if mobile not available
            const contactNum = sourceDataRaw.contactNumber.replace(/\D/g, '');
            if (contactNum.startsWith(countryCode.replace('+', ''))) {
              mobile = contactNum.slice(countryCode.replace('+', '').length);
            } else {
              mobile = contactNum;
            }
          }

          // Helper function to safely get string values
          const safeString = (value) => value ? String(value) : '';
          const safeNumber = (value) => value ? Number(value) : 0;

          const religionOther = safeString(
            sourceDataRaw.otherReligion ||
            sourceDataRaw.raw?.userProfile?.otherReligion ||
            ''
          );
          const languageOther = safeString(
            sourceDataRaw.otherLanguage ||
            sourceDataRaw.raw?.userProfile?.otherLanguage ||
            ''
          );
          const gothramOther = safeString(
            sourceDataRaw.otherGothram ||
            sourceDataRaw.raw?.userProfile?.otherGothram ||
            ''
          );

          const addressString = sourceDataRaw.address || '';
          const addressParts = addressString
            ? addressString.split(',').map((p) => p.trim()).filter(Boolean)
            : [];
          const [addressLine1 = '', addressLine2 = '', city = '', state = '', pincode = '', country = ''] = addressParts;

          const newFormData = {
            ...initialFormData,
            ...sourceDataRaw,
            // Handle raw nested data if it exists
            ...(sourceDataRaw.raw || {}),
            // Ensure all fields have proper default values to prevent undefined
            email: sourceDataRaw.email || '',
            mobile: mobile || '',
            firstName: sourceDataRaw.firstName || '',
            lastName: sourceDataRaw.lastName || '',
            gender: sourceDataRaw.gender || '',
            address: addressString,
            addressLine1,
            addressLine2,
            city,
            state,
            pincode,
            country: country || 'India',
            maritalStatus: sourceDataRaw.maritalStatus || '',
            spouseName: sourceDataRaw.spouseName || '',
            fatherName: sourceDataRaw.fatherName || '',
            motherName: sourceDataRaw.motherName || '',
            caste: sourceDataRaw.caste || '',
            kuladevata: sourceDataRaw.kuladevata || '',
            region: sourceDataRaw.region || '',
            hobbies: sourceDataRaw.hobbies || '',
            likes: sourceDataRaw.likes || '',
            dislikes: sourceDataRaw.dislikes || '',
            favoriteFoods: sourceDataRaw.favoriteFoods || '',
            bio: sourceDataRaw.bio || '',
            dob: sourceDataRaw.dob ? new Date(sourceDataRaw.dob).toISOString().split('T')[0] : '',
            marriageDate: sourceDataRaw.marriageDate
              ? new Date(sourceDataRaw.marriageDate).toISOString().split('T')[0]
              : '',
            childrenNames,
            childrenCount: sourceDataRaw.childrenCount || childrenNames.length || 0,
            profileImageUrl: sourceDataRaw.profileUrl || sourceDataRaw.profile || '',
            profileImageFile: null,
            familyCode: sourceDataRaw.familyCode || (sourceDataRaw.raw?.familyMember?.familyCode || ''),
            countryCode,
            status: safeString(sourceDataRaw.status || '1'),
            role: safeString(sourceDataRaw.role || '1'),
            religionId:
              safeString(sourceDataRaw.religionId || sourceDataRaw.raw?.userProfile?.religionId || '') ||
              (religionOther ? 'other' : ''),
            religionOther,
            languageId:
              safeString(
                sourceDataRaw.languageId ||
                sourceDataRaw.motherTongue ||
                sourceDataRaw.raw?.userProfile?.languageId ||
                ''
              ) || (languageOther ? 'other' : ''),
            languageOther,
            gothramId:
              safeString(
                sourceDataRaw.gothramId ||
                sourceDataRaw.gothram ||
                sourceDataRaw.raw?.userProfile?.gothramId ||
                sourceDataRaw.raw?.gothramId ||
                ''
              ) || (gothramOther ? 'other' : ''),
            gothramOther,
            // Add age calculation here to prevent the loop
            age: sourceDataRaw.age ? String(sourceDataRaw.age) : '',
          };

          setFormData(newFormData);
          lastMemberDataRef.current = { ...sourceDataRaw };
          setErrors({});
          setApiError('');
          setShowPasswordField(false);
        } else {
          setFormData(initialFormData);
          lastMemberDataRef.current = {};
          setErrors({});
          setApiError('');
          setShowPasswordField(true);
        }

        hasInitializedForm.current = true;
      }
    } else {
      // Reset on modal close
      hasInitializedForm.current = false;
    }
  }, [isOpen, mode, memberData, userInfo]);

  // FIXED: Age calculation useEffect - removed formData.age from dependencies
  useEffect(() => {
    if (formData.dob) {
      const birthDate = new Date(formData.dob);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      
      // Only update if the calculated age is different from current formData.age
      const ageString = calculatedAge.toString();
      if (formData.age !== ageString) {
        setFormData((prevData) => ({ ...prevData, age: ageString }));
      }
    } else if (formData.age !== '') {
      setFormData((prevData) => ({ ...prevData, age: '' }));
    }
  }, [formData.dob]); // Only depend on dob, not age

  // Enhanced fetchDropdownData function with error handling
  const fetchDropdownData = async () => {
    try {
      setDropdownData(prev => ({ ...prev, loading: true, error: null }));

      const endpoints = [
        `${import.meta.env.VITE_API_BASE_URL}/language`,
        `${import.meta.env.VITE_API_BASE_URL}/religion`,
        `${import.meta.env.VITE_API_BASE_URL}/gothram`
      ];

      const responses = await Promise.all(
        endpoints.map(url => fetch(url).then(res => {
          if (!res.ok) throw new Error(`Failed to fetch ${url}`);
          return res.json();
        }))
      );

      // Extract data based on your API structure
      const languages = responses[0]?.data || responses[0] || [];
      const religions = responses[1]?.data || responses[1] || [];
      const gothrams = responses[2]?.data || responses[2] || [];

      // Add fallback Indian religions and languages when API lists are empty
      const fallbackLanguages = INDIAN_LANGUAGES.map((lang) => ({ id: lang, name: lang }));
      const fallbackReligions = INDIAN_RELIGIONS.map((rel) => ({ id: rel, name: rel }));

      setDropdownData({
        languages: languages.length > 0 ? languages : fallbackLanguages,
        religions: religions.length > 0 ? religions : fallbackReligions,
        gothrams,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      setDropdownData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load dropdown options'
      }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDropdownData();
    }
  }, [isOpen]);

  // FIXED: Improved dropdown data effect to prevent unnecessary updates
  useEffect(() => {
    if (!dropdownData.loading && dropdownData.gothrams.length > 0 && (mode === 'edit-profile' || mode === 'edit-member')) {
      const sourceDataRaw = mode === 'edit-profile' ? userInfo : memberData;
      if (!sourceDataRaw) return;

      // Only update if the current gothramId is empty or invalid
      const currentGothramId = formData.gothramId;
      const isValidGothram = currentGothramId && dropdownData.gothrams.find(g => String(g.id) === String(currentGothramId));
      
      if (!isValidGothram) {
        const gothramId = String(
          sourceDataRaw.gothramId || 
          sourceDataRaw.gothram ||
          sourceDataRaw.raw?.userProfile?.gothramId ||
          sourceDataRaw.raw?.gothramId ||
          ''
        );
        
        if (gothramId && dropdownData.gothrams.find(g => String(g.id) === gothramId)) {
          setFormData(prevData => ({
            ...prevData,
            gothramId
          }));
        }
      }
    }
  }, [dropdownData.loading, dropdownData.gothrams.length, mode]); // Removed formData.gothramId from deps

  // Rest of your component methods remain the same...
  const validate = () => {
    const newErrors = {};

    const textNameRegex = /^[A-Za-z][A-Za-z ]*$/;
    const selectedRelFromApi = dropdownData.religions.find(
      (r) => String(r.id) === String(formData.religionId)
    );
    const selectedReligionName = selectedRelFromApi?.name || String(formData.religionId || '');
    const isHinduReligion = /hindu/i.test(selectedReligionName);

    // Account Information Validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!String(formData.mobile || '').trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^\d{6,14}$/.test(String(formData.mobile || '').trim())) {
      newErrors.mobile = 'Invalid mobile number';
    }

    if (mode === 'add' && !formData.password.trim()) {
      newErrors.password = 'Password is required';
    }

    // Personal Information Validation
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';

    if (!formData.dob.trim()) {
      newErrors.dob = 'Date of birth is required';
    } else {
      const today = new Date();
      const birthDate = new Date(formData.dob);
      if (birthDate >= today) {
        newErrors.dob = 'Date of birth must be in the past';
      }
    }

    // Family Information Validation
    if (!formData.maritalStatus) newErrors.maritalStatus = 'Marital status is required';

    if (formData.maritalStatus === 'Married') {
      if (!formData.marriageDate) newErrors.marriageDate = 'Marriage date is required for married individuals';
      if (!formData.spouseName.trim()) newErrors.spouseName = 'Spouse name is required for married individuals';
    }

    if (String(formData.fatherName || '').trim() && !textNameRegex.test(String(formData.fatherName || '').trim())) {
      newErrors.fatherName = "Father's name can contain only letters and spaces";
    }

    if (String(formData.motherName || '').trim() && !textNameRegex.test(String(formData.motherName || '').trim())) {
      newErrors.motherName = "Mother's name can contain only letters and spaces";
    }

    if (String(formData.caste || '').trim() && !textNameRegex.test(String(formData.caste || '').trim())) {
      newErrors.caste = "Caste can contain only letters and spaces";
    }

    if (
      isHinduReligion &&
      String(formData.kuladevata || '').trim() &&
      !textNameRegex.test(String(formData.kuladevata || '').trim())
    ) {
      newErrors.kuladevata = "Kuladevata can contain only letters and spaces";
    }

    if (String(formData.region || '').trim() && !textNameRegex.test(String(formData.region || '').trim())) {
      newErrors.region = "Region can contain only letters and spaces";
    }

    if (formData.religionId === 'other' && !String(formData.religionOther || '').trim()) {
      newErrors.religionOther = 'Please enter religion';
    }

    if (formData.languageId === 'other' && !String(formData.languageOther || '').trim()) {
      newErrors.languageOther = 'Please enter mother tongue';
    }

    if (isHinduReligion && formData.gothramId === 'other' && !String(formData.gothramOther || '').trim()) {
      newErrors.gothramOther = 'Please enter gothram';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstErrorFieldName = Object.keys(newErrors)[0];
      const errorElement = document.querySelector(`[name="${firstErrorFieldName}"], [id="${firstErrorFieldName}"]`);
      if (errorElement) {
        firstErrorRef.current = errorElement;
      }
      return false;
    }
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    const restrictedNameFields = new Set([
      'fatherName',
      'motherName',
      'caste',
      'kuladevata',
      'region',
    ]);

    const sanitizedValue = restrictedNameFields.has(name)
      ? String(value || '').replace(/[^A-Za-z ]/g, '')
      : (value || '');

    setFormData((prevData) => ({
      ...prevData,
      [name]: sanitizedValue, // Ensure value is never undefined
      ...(name === 'religionId' && sanitizedValue !== 'other' && { religionOther: '' }),
      ...(name === 'languageId' && sanitizedValue !== 'other' && { languageOther: '' }),
      ...(name === 'gothramId' && sanitizedValue !== 'other' && { gothramOther: '' }),
    }));

    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
    setApiError('');
  };

  const handleMobileChange = (value, data, fieldName) => {
    const dialCode = `+${data.dialCode}`;
    const fullNumber = value.replace(/\D/g, '');
    const mobile = fullNumber.startsWith(data.dialCode)
      ? fullNumber.slice(data.dialCode.length)
      : fullNumber;

    setFormData(prev => ({
      ...prev,
      [fieldName]: mobile || '', // Ensure never undefined
      countryCode: dialCode
    }));

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  const getFullMobile = (countryCode, mobile) => {
    return `${countryCode.replace('+', '')}${mobile || ''}`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedImageTypes = new Set([
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ]);

      if (!allowedImageTypes.has(String(file.type || '').toLowerCase())) {
        Swal.fire({
          icon: 'warning',
          title: 'Invalid file',
          text: 'Only image files (jpeg, jpg, png, gif, webp) are allowed.',
          confirmButtonColor: '#3f982c',
        });
        e.target.value = '';
        return;
      }

      setFormData((prevData) => ({
        ...prevData,
        profileImageFile: file,
        profileImageUrl: URL.createObjectURL(file),
        removeProfile: false,
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        profileImageFile: null,
        profileImageUrl: memberData.profileImage || '',
        removeProfile: false,
      }));
    }
  };

  const handleRemoveProfilePicture = async (options = {}) => {
    const { skipConfirm = false } = options;

    if (!skipConfirm) {
      const result = await Swal.fire({
        title: 'Remove profile picture?',
        text: 'Your profile picture will be removed.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
      });

      if (!result.isConfirmed) return;
    }

    setFormData((prev) => ({
      ...prev,
      profileImageFile: null,
      profileImageUrl: '',
      removeProfile: true,
    }));
  };

  const handleProfilePhotoActionSheet = async () => {
    const currentUrl = String(
      formData.profileImageUrl || formData.profileUrl || formData.profileImageUrl || ''
    ).trim();
    const hasProfilePhoto = Boolean(currentUrl) && !/\/assets\/user\.png$/i.test(currentUrl);

    const result = await Swal.fire({
      title: 'Change Profile Photo',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Upload Photo',
      denyButtonText: 'Remove Photo',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
      denyButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: false,
      didOpen: () => {
        const cancelBtn = Swal.getCancelButton();
        const confirmBtn = Swal.getConfirmButton();
        const denyBtn = Swal.getDenyButton();

        if (cancelBtn) cancelBtn.style.order = '1';
        if (confirmBtn) confirmBtn.style.order = '2';
        if (denyBtn) denyBtn.style.order = '3';
      },
    });

    if (result.isConfirmed) {
      profileFileInputRef.current?.click?.();
      return;
    }

    if (result.isDenied) {
      if (!hasProfilePhoto) {
        Swal.fire({
          icon: 'info',
          title: 'No photo',
          text: 'No profile picture to remove.',
          timer: 1500,
          showConfirmButton: false,
        });
        return;
      }

      await handleRemoveProfilePicture({ skipConfirm: true });
    }
  };

  const getPasswordResetUsername = () => {
    const usernameFromEmail = String(userInfo?.email || formData.email || '').trim();
    const usernameFromMobile = String(formData.mobile || '').trim();
    return usernameFromEmail || usernameFromMobile;
  };

  const handleTogglePasswordChange = () => {
    setShowPasswordChange((prev) => !prev);
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
  };

  const handleSendOtp = async () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const username = getPasswordResetUsername();

    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    if (!username) {
      setPasswordChangeError('Email or mobile number is required to change password.');
      return;
    }

    try {
      setOtpSending(true);
      const sendRes = await fetch(`${baseUrl}/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!sendRes.ok) {
        const errorData = await sendRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send OTP. Please try again.');
      }

      setOtpSent(true);
      setPasswordChangeSuccess('OTP sent successfully.');
    } catch (e) {
      setPasswordChangeError(e?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleUpdatePassword = async () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const username = getPasswordResetUsername();

    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    const otp = String(otpValue || '').trim();
    const newPassword = String(newPasswordValue || '');
    const confirmPassword = String(confirmPasswordValue || '');

    if (!username) {
      setPasswordChangeError('Email or mobile number is required to change password.');
      return;
    }

    if (!otp || !newPassword || !confirmPassword) {
      setPasswordChangeError('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match.');
      return;
    }

    const strong =
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
    if (!strong) {
      setPasswordChangeError(
        'Password must be at least 8 characters and include 1 uppercase letter and 1 special character.'
      );
      return;
    }

    try {
      setPasswordUpdating(true);
      const resetRes = await fetch(`${baseUrl}/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, otp, newPassword, confirmPassword }),
      });

      if (!resetRes.ok) {
        const errorData = await resetRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to reset password. Please try again.');
      }

      setPasswordChangeSuccess('Your password has been updated successfully.');
      setOtpValue('');
      setNewPasswordValue('');
      setConfirmPasswordValue('');
      setOtpSent(false);
      setShowPasswordChange(false);
    } catch (e) {
      setPasswordChangeError(e?.message || 'Failed to reset password. Please try again.');
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) {
      if (firstErrorRef.current) {
        firstErrorRef.current.focus();
      }
      return;
    }

    setIsLoading(true);

    const allowedFields = [
      'profile',
      'firstName',
      'lastName',
      'gender',
      'dob',
      'age',
      'maritalStatus',
      'marriageDate',
      'spouseName',
      'childrenNames',
      'fatherName',
      'motherName',
      'religionId',
      'languageId',
      'gothramId',
      'caste',
      'kuladevata',
      'region',
      'hobbies',
      'likes',
      'dislikes',
      'favoriteFoods',
      'countryId',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'pincode',
      'country',
      'bio',
      'familyCode',
      'email',
      'mobile',
      'countryCode',
      'role',
      'status',
    ];

    const formDataToSend = new FormData();

    // Build a single address string from structured fields (if present)
    const addressPartsToSend = [
      formData.addressLine1,
      formData.addressLine2,
      formData.city,
      formData.state,
      formData.pincode,
      formData.country,
    ]
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    const mergedAddress = addressPartsToSend.join(', ');

    // Always send the combined address field expected by the backend
    if (mergedAddress) {
      formDataToSend.append('address', mergedAddress);
    } else if (formData.address) {
      formDataToSend.append('address', formData.address);
    }

    // Append allowed fields
    allowedFields.forEach((field) => {
      const value = formData[field];

      if (value !== undefined && value !== null && `${value}`.trim() !== '') {
        if (
          ['religionId', 'languageId', 'gothramId', 'countryId', 'age', 'status', 'role'].includes(field)
        ) {
          if (value === 'other') {
            return;
          }
          const n = parseInt(value);
          if (!Number.isNaN(n)) {
            formDataToSend.append(field, n);
          }
        } else if (field === 'childrenNames' && Array.isArray(value)) {
          formDataToSend.append(field, JSON.stringify(value));
        } else {
          formDataToSend.append(field, value);
        }
      }
    });

    if (formData.religionId === 'other') {
      formDataToSend.append('otherReligion', String(formData.religionOther || '').trim());
    }

    if (formData.languageId === 'other') {
      formDataToSend.append('otherLanguage', String(formData.languageOther || '').trim());
    }

    if (formData.gothramId === 'other') {
      formDataToSend.append('otherGothram', String(formData.gothramOther || '').trim());
    }
    
    if (!formDataToSend.has('familyCode') && userInfo?.familyCode) {
      formDataToSend.append('familyCode', userInfo.familyCode);
    }

    if (formData.profileImageFile instanceof File) {
      formDataToSend.append('profile', formData.profileImageFile);
    } else if (formData.removeProfile) {
      formDataToSend.append('removeProfile', 'true');
    }
    
    let apiUrl = '';
    let httpMethod = '';

    if (mode === 'add') {
      apiUrl = `${import.meta.env.VITE_API_BASE_URL}/family/member/register-and-join-family`;
      httpMethod = 'POST';
    } else {
      // For edit-profile mode: use logged user's ID
      // For edit-member mode: use member's ID
      let userId;
      
      if (mode === 'edit-profile') {
        // Try multiple possible ID fields for user profile
        userId = userInfo?.userId || userInfo?.id || formData.userId || formData.id;
      } else {
        // Try multiple possible ID fields for member data
        userId = memberData.id || memberData.userId || formData.userId || formData.id;
      }
      
      // Validate that we have a valid userId
      if (!userId) {
        setApiError('User ID not found. Please refresh the page and try again.');
        setIsLoading(false);
        return;
      }
      
      apiUrl = `${import.meta.env.VITE_API_BASE_URL}/user/profile/update/${userId}`;
      httpMethod = 'PUT';
    }

    try {
      const token = localStorage.getItem('access_token');
      
      const headers = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
     
      const response = await fetch(apiUrl, {
        method: httpMethod,
        body: formDataToSend,
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Operation failed. Please try again.';
        setApiError(errorMessage);
        return;
      }

      const resultData = await response.json();
      
      // Always show success alert for add mode
      if (mode === 'add') {
        if (onAddMember) {
          onAddMember(resultData);
        }
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Family member created successfully.',
          confirmButtonColor: '#3f982c',
        }).then(() => {
          if (variant !== 'page') {
            window.location.reload();
          }
        });
      } else {
        // For edit modes, always show alert regardless of callback
        if (onUpdateProfile) {
          onUpdateProfile(resultData);
        }
        
        // Check if family code was updated (joining new family)
        const originalFamilyCode = lastMemberDataRef.current.familyCode || userInfo?.familyCode || '';
        const newFamilyCode = formData.familyCode || '';
        
        if (originalFamilyCode !== newFamilyCode && newFamilyCode) {
          // Family code changed - show approval pending message
          Swal.fire({
            icon: 'info',
            title: 'Family Join Request Sent!',
            text: 'Your request to join the family has been sent. Please wait for the family admin to approve your request.',
            confirmButtonColor: '#3f982c',
          }).then(() => {
            if (variant !== 'page') {
              window.location.reload();
            }
          });
        } else {
          // Regular profile update
          const alertTitle = mode === 'edit-profile' ? 'Profile Updated!' : 'Member Updated!';
          const alertText = mode === 'edit-profile' ? 'Your profile has been updated successfully.' : 'Family member has been updated successfully.';
          
          Swal.fire({
            icon: 'success',
            title: alertTitle,
            text: alertText,
            confirmButtonColor: '#3f982c',
          }).then(() => {
            if (variant !== 'page') {
              window.location.reload();
            }
          });
        }
      }
      if (variant !== 'page') {
        onClose();
      }
      
    } catch (error) {
      const errorMessage = 'Network error or server unreachable. Please try again.';
      setApiError(errorMessage);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Something went wrong. Please try again!',
        confirmButtonColor: '#d33',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This action cannot be undone. Your profile will be permanently deleted!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete my profile!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setIsDeleting(true);
      
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const userId = userInfo?.userId;
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'accept': '*/*'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.message || 'Failed to delete profile';
          throw new Error(errorMessage);
        }

        // Clear local storage and redirect to login
        localStorage.removeItem('access_token');
        
        Swal.fire({
          icon: 'success',
          title: 'Profile Deleted!',
          text: 'Your profile has been successfully deleted.',
          confirmButtonColor: '#10b981',
        }).then(() => {
          window.location.href = '/login';
        });
        
      } catch (error) {
        console.error('Error deleting profile:', error);
        const errorMessage = error.message || 'Failed to delete profile. Please try again.';
        setApiError(errorMessage);
        
        Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: errorMessage,
          confirmButtonColor: '#d33',
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const isPageVariant = variant === 'page';

  if (!isPageVariant && !isOpen) return null;

  const title = mode === 'add' ? 'Add New Family Member' : (mode === 'edit-profile' ? 'Edit Profile' : 'Edit Family Member Profile');
  
  const submitButtonText = isLoading ? 'Processing...' : (mode === 'add' ? 'Add Member' : 'Save');
  const lockEmailAndMobile = mode === 'edit-profile' || mode === 'edit-member';

  const inputClassName = (fieldName) => `w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-1 text-sm font-inter text-gray-800 placeholder-gray-400 ${
    errors[fieldName] ? 'border-red-500 focus:ring-red-300' : 'border-gray-300 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
  }`;

  const sectionClassName = "bg-white p-6 rounded-lg space-y-4 border border-gray-200";
  const labelClassName = "block text-sm font-medium text-gray-700 mb-1";

  const selectedRelFromApiUI = dropdownData.religions.find(
    (r) => String(r.id) === String(formData.religionId)
  );
  const selectedReligionNameUI = selectedRelFromApiUI?.name || String(formData.religionId || '');
  const isHinduReligionUI = /hindu/i.test(selectedReligionNameUI);

  const outerClassName = isPageVariant
    ? "w-full font-inter px-3 sm:px-4 py-4 sm:py-6"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 font-inter";

  const containerClassName = isPageVariant
    ? "w-full max-w-5xl mx-auto"
    : "bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto";

  const headerClassName = isPageVariant
    ? "flex justify-between items-center mb-4 sm:mb-6"
    : "flex justify-between items-center p-5 border-b border-gray-200 sticky top-0 bg-white z-10";

  const titleClassName = isPageVariant
    ? "text-xl sm:text-2xl font-bold text-gray-800"
    : "text-2xl font-bold text-gray-800";

  const contentWrapperClassName = isPageVariant
    ? ""
    : "p-6";

  return (
    <div className={outerClassName}>
      <div className={containerClassName}>
        <div className={headerClassName}>
          <div className="flex items-center gap-3">
            {isPageVariant && (
              <button
                type="button"
                onClick={onClose}
                className="bg-unset inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <FiArrowLeft className="mr-1 h-4 w-4" />
                <span className="hidden xs:inline sm:inline">Back</span>
              </button>
            )}
            <h2 className={titleClassName}>{title}</h2>
          </div>

          {!isPageVariant && (
            <button
              onClick={onClose}
              className="bg-unset p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <div className={contentWrapperClassName}>

          {apiError && (
            <div 
              ref={errorRef}
              tabIndex="-1"
              className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-red-500"
              role="alert"
              aria-live="polite"
            >
              <span>{apiError}</span>
              <button 
                onClick={() => setApiError('')} 
                className="bg-unset text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                aria-label="Close error message"
              >
                &times;
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Profile Image Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Picture</h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <button
                  type="button"
                  onClick={handleProfilePhotoActionSheet}
                  className="relative group focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-50 rounded-lg"
                  title="Change profile photo"
                >
                  <div className="w-32 h-32 rounded-lg border-2 border-gray-200 overflow-hidden shadow-sm flex items-center justify-center bg-gray-100">
                    {formData.profileImageUrl || formData.profileUrl ? (
                      <img
                        src={formData.profileImageUrl || formData.profileUrl}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/128x128/cccccc/ffffff?text=No+Image'; }}
                      />
                    ) : (
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Change Photo</span>
                  </div>
                </button>
                <div className="flex-1 w-full">
                  <label htmlFor="profile" className={labelClassName}>
                    Upload New Image
                  </label>
                  <input
                    id="profile"
                    name="profile"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    ref={profileFileInputRef}
                    className="w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-medium
                      file:bg-[var(--color-primary)] file:text-white
                      hover:file:bg-[var(--color-primary)] file:cursor-pointer"
                  />
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG or GIF (Max. 5MB)</p>
                </div>
              </div>
            </div>

            {/* Account Information Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               
                <div>
                  <label htmlFor="email" className={labelClassName}>
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    disabled={lockEmailAndMobile}
                    className={`${inputClassName('email')} ${lockEmailAndMobile ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="your@email.com"
                    maxLength={255}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                
                {/* Login Mobile Number */}
                <div>
                  <label htmlFor="mobile" className={labelClassName}>
                    Login Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <PhoneInput
                    inputClass={errors.mobile ? 'border border-red-500 focus:border-red-500' : 'border border-gray-300'}
                    country={'in'}
                    value={getFullMobile(formData.countryCode || '+91', formData.mobile || '')}
                    onChange={(value, data) => handleMobileChange(value, data, 'mobile')}
                    disabled={lockEmailAndMobile}
                    inputProps={{
                      name: 'mobile',
                      required: true,
                      id: 'mobile',
                      ref: mobileRef,
                      disabled: lockEmailAndMobile,
                    }}
                    containerStyle={{ width: '100%' }}
                    inputStyle={{
                      width: '100%',
                      height: '42px',
                      fontSize: '14px',
                      paddingLeft: '48px',
                      border: `1px solid ${errors.mobile ? '#ef4444' : '#d1d5db'}`,
                      borderRadius: '8px',
                      backgroundColor: lockEmailAndMobile ? '#f3f4f6' : 'white',
                    }}
                    buttonStyle={{
                      border: `1px solid ${errors.mobile ? '#ef4444' : '#d1d5db'}`,
                      borderRight: 'none',
                      borderRadius: '8px 0 0 8px',
                      backgroundColor: lockEmailAndMobile ? '#f3f4f6' : 'white',
                    }}
                  />
                  {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
                </div>
                
                {canEditAccountSettings && (
                  <>
                    <div>
                      <label htmlFor="status" className={labelClassName}>
                        Account Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status || '1'} // FIXED: Ensure never undefined
                        onChange={handleChange}
                        className={inputClassName('status')}
                      >
                        <option value="0">Unverified</option>
                        <option value="1">Active</option>
                        <option value="2">Inactive</option>
                        <option value="3">Deleted</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="role" className={labelClassName}>
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="role"
                        name="role"
                        value={formData.role || '1'} // FIXED: Ensure never undefined
                        onChange={handleChange}
                        className={inputClassName('role')}
                      >
                        <option value="1">Member</option>
                        <option value="2">Admin</option>
                        {userInfo?.role === 3 && <option value="3">Superadmin</option>}
                      </select>
                    </div>
                  </>
                )}

                {(mode === 'add' || showPasswordField) && (
                  <div className="relative">
                    <label htmlFor="password" className={labelClassName}>
                      Password {mode === 'add' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password || ''} // FIXED: Ensure never undefined
                      onChange={handleChange}
                      className={inputClassName('password') + ' pr-10'}
                      placeholder="••••••••"
                      maxLength={255}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="bg-unset text-primary absolute right-3 top-[34px] hover:text-gray-700"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.05 11.05 0 013.304-4.348M3 3l18 18M16.24 16.24A5 5 0 017.76 7.76" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12s-4 6.5-10.5 6.5S1.5 12 1.5 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  </div>
                )}
                {mode !== 'add' && !showPasswordField && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTogglePasswordChange}
                      className="bg-unset text-sm text-[var(--color-primary)] hover:underline"
                    >
                      Change Password
                    </button>
                  </div>
                )}

                {mode !== 'add' && !showPasswordField && showPasswordChange && (
                  <div className="md:col-span-2">
                    {passwordChangeError ? (
                      <div className="mb-3 p-3 text-sm text-red-700 bg-red-100 rounded border border-red-300">
                        {passwordChangeError}
                      </div>
                    ) : null}
                    {passwordChangeSuccess ? (
                      <div className="mb-3 p-3 text-sm text-green-700 bg-green-100 rounded border border-green-300">
                        {passwordChangeSuccess}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="passwordOtp" className={labelClassName}>
                          OTP
                        </label>
                        <input
                          id="passwordOtp"
                          name="passwordOtp"
                          type="text"
                          value={otpValue}
                          onChange={(e) => setOtpValue(e.target.value)}
                          className={inputClassName('passwordOtp')}
                          placeholder="123456"
                          maxLength={12}
                        />
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpSending}
                          className="mt-2 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white disabled:opacity-60"
                        >
                          {otpSending ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                        </button>
                      </div>

                      <div>
                        <label htmlFor="newPasswordInline" className={labelClassName}>
                          New Password
                        </label>
                        <div className="relative">
                          <input
                            id="newPasswordInline"
                            name="newPasswordInline"
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPasswordValue}
                            onChange={(e) => setNewPasswordValue(e.target.value)}
                            className={inputClassName('newPasswordInline') + ' pr-10'}
                            placeholder="New password"
                            maxLength={255}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="bg-unset text-primary absolute right-3 top-[10px] hover:text-gray-700"
                          >
                            {showNewPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.05 11.05 0 013.304-4.348M3 3l18 18M16.24 16.24A5 5 0 017.76 7.76" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12s-4 6.5-10.5 6.5S1.5 12 1.5 12z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Password must be at least 8 characters and include 1 uppercase letter and 1 special character.
                        </div>
                      </div>

                      <div>
                        <label htmlFor="confirmPasswordInline" className={labelClassName}>
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            id="confirmPasswordInline"
                            name="confirmPasswordInline"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPasswordValue}
                            onChange={(e) => setConfirmPasswordValue(e.target.value)}
                            className={inputClassName('confirmPasswordInline') + ' pr-10'}
                            placeholder="Confirm password"
                            maxLength={255}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="bg-unset text-primary absolute right-3 top-[10px] hover:text-gray-700"
                          >
                            {showConfirmPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.05 11.05 0 013.304-4.348M3 3l18 18M16.24 16.24A5 5 0 017.76 7.76" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12s-4 6.5-10.5 6.5S1.5 12 1.5 12z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleUpdatePassword}
                          disabled={passwordUpdating}
                          className="mt-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white disabled:opacity-60"
                        >
                          {passwordUpdating ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Personal Information Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className={labelClassName}>
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('firstName')}
                    placeholder="First name"
                    maxLength={60}
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClassName}>
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('lastName')}
                    placeholder="Last name"
                    maxLength={60}
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <label htmlFor="gender" className={labelClassName}>
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('gender')}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                </div>
                <div>
                  <label htmlFor="dob" className={labelClassName}>
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="dob"
                      name="dob"
                      type="date"
                      value={formData.dob || ''} // FIXED: Ensure never undefined
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      className={`${inputClassName('dob')} pr-10`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    {formData.dob && (
                      <div className="absolute inset-y-0 right-8 flex items-center pr-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, dob: '' }));
                            if (errors.dob) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.dob;
                                return newErrors;
                              });
                            }
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {formData.dob && (
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Selected: {new Date(formData.dob).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  )}
                  {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
                </div>
                <div>
                  <label htmlFor="age" className={labelClassName}>
                    Age
                  </label>
                  <input
                    id="age"
                    name="age"
                    type="text"
                    value={formData.age || ''} // FIXED: Ensure never undefined
                    readOnly
                    className={`${inputClassName('age')} bg-gray-100 cursor-not-allowed`}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="addressLine1" className={labelClassName}>
                    Address Line 1
                  </label>
                  <input
                    id="addressLine1"
                    name="addressLine1"
                    type="text"
                    value={formData.addressLine1 || ''}
                    onChange={handleChange}
                    className={inputClassName('addressLine1')}
                    placeholder="Flat / House / Street"
                    maxLength={150}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="addressLine2" className={labelClassName}>
                    Address Line 2 (Optional)
                  </label>
                  <input
                    id="addressLine2"
                    name="addressLine2"
                    type="text"
                    value={formData.addressLine2 || ''}
                    onChange={handleChange}
                    className={inputClassName('addressLine2')}
                    placeholder="Area / Landmark"
                    maxLength={150}
                  />
                </div>
                <div>
                  <label htmlFor="city" className={labelClassName}>
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    value={formData.city || ''}
                    onChange={handleChange}
                    className={inputClassName('city')}
                    placeholder="City"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label htmlFor="state" className={labelClassName}>
                    State
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    value={formData.state || ''}
                    onChange={handleChange}
                    className={inputClassName('state')}
                    placeholder="State"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className={labelClassName}>
                    Pincode
                  </label>
                  <input
                    id="pincode"
                    name="pincode"
                    type="text"
                    value={formData.pincode || ''}
                    onChange={handleChange}
                    className={inputClassName('pincode')}
                    placeholder="e.g., 600001"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label htmlFor="country" className={labelClassName}>
                    Country
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    value={formData.country || ''}
                    onChange={handleChange}
                    className={inputClassName('country')}
                    placeholder="Country"
                    maxLength={80}
                  />
                </div>
              </div>
            </div>

            {/* Family Information Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Family Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="maritalStatus" className={labelClassName}>
                    Marital Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="maritalStatus"
                    name="maritalStatus"
                    value={formData.maritalStatus || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('maritalStatus')}
                  >
                    <option value="">Select Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                  {errors.maritalStatus && <p className="text-red-500 text-xs mt-1">{errors.maritalStatus}</p>}
                </div>
                
                {formData.maritalStatus === 'Married' && (
                  <>
                    <div>
                      <label htmlFor="marriageDate" className={labelClassName}>
                        Marriage Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="marriageDate"
                        name="marriageDate"
                        type="date"
                        value={formData.marriageDate || ''} // FIXED: Ensure never undefined
                        onChange={handleChange}
                        className={inputClassName('marriageDate')}
                      />
                      {errors.marriageDate && <p className="text-red-500 text-xs mt-1">{errors.marriageDate}</p>}
                    </div>
                    <div>
                      <label htmlFor="spouseName" className={labelClassName}>
                        Spouse Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="spouseName"
                        name="spouseName"
                        type="text"
                        value={formData.spouseName || ''} // FIXED: Ensure never undefined
                        onChange={handleChange}
                        className={inputClassName('spouseName')}
                        placeholder="Spouse's full name"
                        maxLength={80}
                      />
                      {errors.spouseName && <p className="text-red-500 text-xs mt-1">{errors.spouseName}</p>}
                    </div>
                    <div>
                      <label htmlFor="childrenCount" className={labelClassName}>
                        Number of Children
                      </label>
                      <input
                        type="number"
                        id="childrenCount"
                        name="childrenCount"
                        min="0"
                        value={formData.childrenCount || 0}
                        onChange={(e) => {
                          const count = Math.max(0, parseInt(e.target.value) || 0);
                          setFormData(prev => ({
                            ...prev,
                            childrenCount: count,
                            childrenNames: Array(count).fill('').map((_, i) =>
                              prev.childrenNames && prev.childrenNames[i] ? prev.childrenNames[i] : ''
                            )
                          }));
                        }}
                        className={inputClassName('childrenCount')}
                      />
                    </div>
                    
                    {/* Dynamic child name inputs */}
                    {formData.childrenCount > 0 && (
                      <div className="md:col-span-2 space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Children Names</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Array.from({ length: formData.childrenCount }).map((_, index) => (
                            <div key={index}>
                              <label htmlFor={`child-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
                                Child {index + 1}
                              </label>
                              <input
                                id={`child-${index}`}
                                name={`child-${index}`}
                                type="text"
                                value={formData.childrenNames?.[index] || ''} // FIXED: Ensure never undefined
                                onChange={(e) => {
                                  const newChildrenNames = [...(formData.childrenNames || [])];
                                  newChildrenNames[index] = e.target.value || '';
                                  setFormData(prev => ({
                                    ...prev,
                                    childrenNames: newChildrenNames
                                  }));
                                }}
                                className={inputClassName('childrenNames')}
                                placeholder={`Child ${index + 1} name`}
                                maxLength={80}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                <div>
                  <label htmlFor="fatherName" className={labelClassName}>
                    Father's Name
                  </label>
                  <input
                    id="fatherName"
                    name="fatherName"
                    type="text"
                    value={formData.fatherName || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('fatherName')}
                    placeholder="Father's name"
                    maxLength={80}
                  />
                  {errors.fatherName && <p className="text-red-500 text-xs mt-1">{errors.fatherName}</p>}
                </div>
                <div>
                  <label htmlFor="motherName" className={labelClassName}>
                    Mother's Name
                  </label>
                  <input
                    id="motherName"
                    name="motherName"
                    type="text"
                    value={formData.motherName || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('motherName')}
                    placeholder="Mother's name"
                    maxLength={80}
                  />
                  {errors.motherName && <p className="text-red-500 text-xs mt-1">{errors.motherName}</p>}
                </div>
                <div>
                  <label htmlFor="familyCode" className={labelClassName}>
                    Family Code
                  </label>
                  <input
                    id="familyCode"
                    name="familyCode"
                    type="text"
                    value={formData.familyCode || userInfo?.familyCode || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={`${inputClassName('familyCode')} bg-gray-100 cursor-not-allowed`}
                    placeholder="FAM000123"
                    maxLength={50}
                    disabled={mode !== 'add'}
                  />
                </div>
              </div>
            </div>

            {/* Cultural & Background Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Cultural & Background</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Religion Dropdown */}
                <div>
                  <label htmlFor="religionId" className={labelClassName}>
                    Religion
                  </label>
                  <select
                    id="religionId"
                    name="religionId"
                    value={formData.religionId || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('religionId')}
                    disabled={dropdownData.loading}
                  >
                    <option value="">Select Religion</option>
                    {dropdownData.religions.map(religion => (
                      <option key={religion.id} value={String(religion.id)}>
                        {religion.name}
                      </option>
                    ))}
                    <option value="other">Others</option>
                  </select>
                  {dropdownData.loading && (
                    <p className="text-xs text-gray-500 mt-1">Loading religions...</p>
                  )}
                  {formData.religionId === 'other' && (
                    <div className="mt-2">
                      <input
                        name="religionOther"
                        type="text"
                        value={formData.religionOther || ''}
                        onChange={handleChange}
                        className={inputClassName('religionOther')}
                        placeholder="Enter religion"
                        maxLength={80}
                      />
                      {errors.religionOther && <p className="text-red-500 text-xs mt-1">{errors.religionOther}</p>}
                    </div>
                  )}
                </div>
                
                {/* Language Dropdown */}
                <div>
                  <label htmlFor="languageId" className={labelClassName}>
                    Language
                  </label>
                  <select
                    id="languageId"
                    name="languageId"
                    value={formData.languageId || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('languageId')}
                    disabled={dropdownData.loading}
                  >
                    <option value="">Select Language</option>
                    {dropdownData.languages.map(language => (
                      <option key={language.id} value={String(language.id)}>
                        {language.name}
                      </option>
                    ))}
                    <option value="other">Others</option>
                  </select>
                  {dropdownData.loading && (
                    <p className="text-xs text-gray-500 mt-1">Loading languages...</p>
                  )}
                  {formData.languageId === 'other' && (
                    <div className="mt-2">
                      <input
                        name="languageOther"
                        type="text"
                        value={formData.languageOther || ''}
                        onChange={handleChange}
                        className={inputClassName('languageOther')}
                        placeholder="Enter mother tongue"
                        maxLength={80}
                      />
                      {errors.languageOther && <p className="text-red-500 text-xs mt-1">{errors.languageOther}</p>}
                    </div>
                  )}
                </div>
                
                {/* Caste Input */}
                <div>
                  <label htmlFor="caste" className={labelClassName}>
                    Caste
                  </label>
                  <input
                    id="caste"
                    name="caste"
                    type="text"
                    value={formData.caste || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('caste')}
                    placeholder="Enter caste"
                    maxLength={80}
                  />
                  {errors.caste && <p className="text-red-500 text-xs mt-1">{errors.caste}</p>}
                </div>
                
                {isHinduReligionUI && (
                  <>
                    {/* Gothram Dropdown */}
                    <div>
                      <label htmlFor="gothramId" className={labelClassName}>
                        Gothram
                      </label>
                      <select
                        id="gothramId"
                        name="gothramId"
                        value={formData.gothramId || ''} // FIXED: Ensure never undefined
                        onChange={handleChange}
                        className={inputClassName('gothramId')}
                        disabled={dropdownData.loading}
                      >
                        <option value="">Select Gothram</option>
                        {dropdownData.gothrams.map(gothram => (
                          <option key={gothram.id} value={String(gothram.id)}>
                            {gothram.name}
                          </option>
                        ))}
                        <option value="other">Others</option>
                      </select>
                      {dropdownData.loading && (
                        <p className="text-xs text-gray-500 mt-1">Loading gothrams...</p>
                      )}
                      {formData.gothramId === 'other' && (
                        <div className="mt-2">
                          <input
                            name="gothramOther"
                            type="text"
                            value={formData.gothramOther || ''}
                            onChange={handleChange}
                            className={inputClassName('gothramOther')}
                            placeholder="Enter gothram"
                            maxLength={80}
                          />
                          {errors.gothramOther && <p className="text-red-500 text-xs mt-1">{errors.gothramOther}</p>}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="kuladevata" className={labelClassName}>
                        Kuladevata
                      </label>
                      <input
                        id="kuladevata"
                        name="kuladevata"
                        type="text"
                        value={formData.kuladevata || ''} // FIXED: Ensure never undefined
                        onChange={handleChange}
                        className={inputClassName('kuladevata')}
                        placeholder="Family deity"
                        maxLength={80}
                      />
                      {errors.kuladevata && <p className="text-red-500 text-xs mt-1">{errors.kuladevata}</p>}
                    </div>
                  </>
                )}
                
                <div>
                  <label htmlFor="region" className={labelClassName}>
                    Region
                  </label>
                  <input
                    id="region"
                    name="region"
                    type="text"
                    value={formData.region || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('region')}
                    placeholder="e.g., South Tamil Nadu"
                    maxLength={80}
                  />
                  {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className={sectionClassName}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="bio" className={labelClassName}>
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('bio')}
                    placeholder="Tell us about yourself..."
                    rows="3"
                    maxLength={1000}
                  />
                </div>
                <div>
                  <label htmlFor="hobbies" className={labelClassName}>
                    Hobbies
                  </label>
                  <textarea
                    id="hobbies"
                    name="hobbies"
                    value={formData.hobbies || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('hobbies')}
                    placeholder="e.g., Reading, Traveling"
                    rows="2"
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="favoriteFoods" className={labelClassName}>
                    Favorite Foods
                  </label>
                  <textarea
                    id="favoriteFoods"
                    name="favoriteFoods"
                    value={formData.favoriteFoods || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('favoriteFoods')}
                    placeholder="e.g., Dosa, Biryani"
                    rows="2"
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="likes" className={labelClassName}>
                    Likes
                  </label>
                  <textarea
                    id="likes"
                    name="likes"
                    value={formData.likes || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('likes')}
                    placeholder="Things you like"
                    rows="2"
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="dislikes" className={labelClassName}>
                    Dislikes
                  </label>
                  <textarea
                    id="dislikes"
                    name="dislikes"
                    value={formData.dislikes || ''} // FIXED: Ensure never undefined
                    onChange={handleChange}
                    className={inputClassName('dislikes')}
                    placeholder="Things you dislike"
                    rows="2"
                    maxLength={500}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-between items-center pt-4 gap-3">
              {/* Delete Profile Button - Only show for current user profile editing */}
              {isCurrentUserProfile && (
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  disabled={isDeleting}
                  className={`px-4 py-2.5 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white font-medium rounded-lg transition-colors flex items-center ${
                    isDeleting ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  {isDeleting && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isDeleting ? 'Deleting...' : 'Delete Profile'}
                </button>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white font-medium rounded-lg transition-colors flex items-center ${
                    isLoading ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {submitButtonText}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-unset px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileFormModal;
