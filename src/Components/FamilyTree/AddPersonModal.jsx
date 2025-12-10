import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../Contexts/LanguageContext';
import { X, UserPlus, Users, Edit, Plus, UserMinus, Camera, Save, ArrowLeft, Send } from 'lucide-react';
import { fetchRelationships } from '../../utils/familyTreeApi';
import Swal from 'sweetalert2';

const PRIMARY_COLOR = "#1976D2";
const SECONDARY_COLOR = "#f97316";

const AddPersonModal = ({ isOpen, onClose, action, onAddPersons, familyCode, token, existingMemberIds = [] }) => {
    const [count, setCount] = useState(1);
    const [forms, setForms] = useState([]);
    const [imageData, setImageData] = useState({});
    const [imagePreview, setImagePreview] = useState({});
    const [familyMembers, setFamilyMembers] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState(null);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [parentSelections, setParentSelections] = useState({ father: { selectedMemberId: null, showManualEntry: false }, mother: { selectedMemberId: null, showManualEntry: false } });
    const [formSelections, setFormSelections] = useState({});
    const { language } = useLanguage();
    // Add state for relationships
    const [relationshipTypes, setRelationshipTypes] = useState([]);

    // ===== Mobile invite state (for spouse) =====
    // Initialize phoneInvite with all required fields to prevent uncontrolled input warning
    const [phoneInvite, setPhoneInvite] = useState({ 
        phone: '', 
        loading: false, 
        result: null, 
        sending: false,
        requesting: false,
        exists: false,
        user: null
    });

    // Accept digits with optional +country code, spaces, dashes; we will normalize
    const phoneRegex = /^[+]?\d[\d\s-]{8,}$/;

    const handlePhoneSearch = async () => {
        if (!phoneRegex.test(phoneInvite.phone)) return;
        setPhoneInvite(prev => ({ ...prev, loading: true, result: null }));
        try {
            const token = localStorage.getItem('access_token');
            const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api');
            // Normalize to last 10 digits for lookup, backend also sanitizes
            const cleaned = String(phoneInvite.phone).replace(/\D/g, '');
            const last10 = cleaned.slice(-10);
            const res = await fetch(`${API_BASE}/user/lookup?phone=${encodeURIComponent(last10)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await res.json();
            const sameFamily = Boolean(data?.user?.familyCode) && data.user.familyCode === familyCode;
            setPhoneInvite(prev => ({ ...prev, result: { ...data, sameFamily }, loading: false }));
        } catch (err) {
            setPhoneInvite(prev => ({ ...prev, loading: false }));
            Swal.fire({ icon: 'error', title: 'Lookup failed', text: 'Please try again.' });
        }
    };

    const handleSendInvite = async () => {
        try {
            setPhoneInvite(prev => ({ ...prev, sending: true }));
            const token = localStorage.getItem('access_token');
            const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api');
            const res = await fetch(`${API_BASE}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ phone: phoneInvite.phone, inviterId: action.person?.userId || null })
            });
            const data = await res.json();
            const inviteLink = `${window.location.origin}/accept-invite/${data.token}`;
            window.open(`https://wa.me/91${phoneInvite.phone}?text=${encodeURIComponent('Hi! Join our family tree: ' + inviteLink)}`, '_blank');
            setPhoneInvite({ phone: '', loading: false, result: null, sending: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Failed to send invite', text: 'Please try again.' });
            setPhoneInvite(prev => ({ ...prev, sending: false }));
        }
    };

    const handleSendRequest = async () => {
        if (!phoneInvite.result?.exists || !phoneInvite.result?.user?.id) {
            console.error('Invalid user data for association request');
            Swal.fire({ icon: 'warning', title: 'Invalid user data', text: 'Cannot send association request.' });
            return;
        }
        
        try {
            setPhoneInvite(prev => ({ ...prev, requesting: true }));
            const token = localStorage.getItem('access_token');
            
            if (!token) {
                throw new Error('Authentication token not found');
            }

            // Determine requester (logged-in tree person) and target (looked-up user)
            const targetUserId = parseInt(phoneInvite.result.user.id, 10);
            const requesterUserId = action.person?.memberId
                ? parseInt(action.person.memberId, 10)
                : (action.person?.userId ? parseInt(action.person.userId, 10) : undefined);

            if (!requesterUserId || !targetUserId) {
                throw new Error('Missing requester or target user id');
            }

            console.log('Sending association request:', { requesterUserId, targetUserId });

            // Use association request endpoint (approval workflow)
            const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000');
            const response = await fetch(`${API_BASE}/family/request-association`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}`,
                    'accept': 'application/json'
                },
                body: JSON.stringify({ targetUserId, requesterUserId })
            });

            const responseData = await response.json();
            
            if (!response.ok) {
                console.error('Server responded with:', responseData);
                throw new Error(responseData.message || 'Failed to send request');
            }

            // Show success message with person's name
            const requesterName = action.person?.name || 'You';
            const targetName = phoneInvite.result.user.name || 'the user';
            const successMessage = `Association request sent to <b>${targetName}</b> from <b>${requesterName}</b>!`;
            const notificationMessage = `${requesterName} requested a family association with ${targetName}.`;

            await Swal.fire({
                icon: 'success',
                title: 'Request Sent',
                html: `${successMessage}<br/><br/><small>They will receive this notification:</small><br/><em>"${notificationMessage}"</em>`,
                confirmButtonColor: PRIMARY_COLOR,
            });

            // Refresh the page to update family tree data with new associations
            window.location.reload();
            onClose(); // Close the modal on success
        } catch (error) {
            console.error('Error sending request:', error);
            Swal.fire({ icon: 'error', title: 'Failed to send request', text: error.message || 'Please try again.' });
        } finally {
            setPhoneInvite(prev => ({ ...prev, requesting: false }));
        }
    };

    // Fetch relationship types on mount
    useEffect(() => {
        fetchRelationships()
            .then(setRelationshipTypes)
            .catch(() => setRelationshipTypes([]));
    }, []);

    // Helper to get the correct label for a relationship
    const getRelationshipLabel = (rel) => {
        // Map language code to DB field
        const langMap = { ta: 'ta', en: 'en', hi: 'hi', te: 'te', ml: 'ml', kn: 'ka', ka: 'ka' };
        const dbLang = langMap[language] || 'en';
        return rel[`description_${dbLang}`] || rel.description_en || rel.key;
    };

    const titles = {
        parents: 'Add Parents',
        spouse: 'Add Spouse',
        children: 'Add Child',
        siblings: 'Add Sibling',
        edit: 'Edit'
    };

    // Add tab state for each form
    const [activeTabs, setActiveTabs] = useState({});

    // Fetch family members when modal opens
    useEffect(() => {
        if (isOpen && familyCode && token) {
            setLoadingMembers(true);
            const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api');
            fetch(`${API_BASE}/family/member/${familyCode}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'accept': '*/*',
                },
            })
                .then(res => res.json())
                .then(data => {
                    console.log('Family members API response:', data);
                    if (data && data.data) {
                        console.log('Setting family members:', data.data);
                        setFamilyMembers(data.data);
                    } else {
                        console.log('No family members data found');
                        setFamilyMembers([]);
                    }
                })
                .finally(() => setLoadingMembers(false));
        }
    }, [isOpen, familyCode, token]);

    useEffect(() => {
        if (isOpen) {
            generateForms();
            setSelectedMemberId(null);
            setShowManualEntry(false);
            setParentSelections({ father: { selectedMemberId: null, showManualEntry: true }, mother: { selectedMemberId: null, showManualEntry: true } });
            
            // Initialize form selections for other types
            const initialFormSelections = {};
            if (action.type !== 'parents') {
                for (let i = 0; i < count; i++) {
                    initialFormSelections[i] = { selectedMemberId: null, showManualEntry: true };
                }
            }
            setFormSelections(initialFormSelections);
            
            // Default tabs: new (manual entry) as default
            const initialTabs = {};
            if (action.type === 'parents') {
                initialTabs.father = 'new';
                initialTabs.mother = 'new';
            } else {
                for (let i = 0; i < count; i++) {
                    initialTabs[i] = 'new';
                }
            }
            setActiveTabs(initialTabs);
        }
    }, [isOpen, count, action]);

    const generateForms = () => {
        const newForms = [];
        
        if (action.type === 'parents') {
            newForms.push(
                { type: 'father', index: 0, gender: 'male' },
                { type: 'mother', index: 1, gender: 'female' }
            );
        } else if (action.type === 'spouse') {
            newForms.push({ type: 'spouse', index: 0 });
            // Reset phone invite state with all required fields
            setPhoneInvite({
                phone: '',
                loading: false,
                result: null,
                sending: false,
                requesting: false,
                exists: false,
                user: null
            });
        } else if (action.type === 'edit') {
            newForms.push({ type: 'edit', index: 0 });
        } else {
            for (let i = 0; i < count; i++) {
                newForms.push({ type: 'person', index: i });
            }
        }
        
        setForms(newForms);
    };

    // Modified: Get all family members, but mark existing ones as disabled in dropdown
    const getEligibleMembersWithAll = (form) => {
        console.log('getEligibleMembersWithAll called with form:', form);
        console.log('familyMembers array:', familyMembers);
        console.log('familyMembers length:', familyMembers.length);
        
        if (!form) return [];
        let genderFilter = null;
        if (form.type === 'father') genderFilter = 'Male';
        if (form.type === 'mother') genderFilter = 'Female';
        if (form.type === 'spouse' && action.person) {
            // For spouse, need opposite gender. Normalize to lowercase for comparison later
            genderFilter = action.person.gender?.toLowerCase() === 'male' ? 'female' : 'male';
        }
        
        console.log('Gender filter for', form.type, ':', genderFilter);
        
        // For children/siblings, allow both genders
        // Perform case-insensitive gender check to avoid mismatches (e.g., 'Male' vs 'male')
        const filtered = familyMembers.filter(m => {
            console.log('Checking member:', m);
            const gRaw = m.user?.userProfile?.gender || '';
            const g = gRaw.trim().toLowerCase();
            console.log('Member gender:', gRaw, '-> normalized:', g);
            
            // If gender filter is specified, only exclude when gender IS present and clearly opposite to filter.
            if (genderFilter) {
                const gf = genderFilter.toLowerCase();
                if (g && g !== gf) {
                    console.log('Excluding member due to gender mismatch');
                    return false; // mismatch
                }
                // if gender missing, allow; fallback to include
            }
            console.log('Including member');
            return true;
        });
        
        // If no members match the gender filter, show all members anyway (for small families)
        if (filtered.length === 0 && genderFilter && familyMembers.length > 0) {
            console.log('No gender matches found, showing all members for selection');
            return familyMembers;
        }
        
        console.log('Filtered members:', filtered);
        return filtered;
    };

    const handleImageUpload = (event, index) => {
        const file = event.target.files[0];
        if (!file) return;
        // Store the File object directly for binary upload
        setImageData(prev => ({
            ...prev,
            [index]: file
        }));
        // Generate preview URL
        const url = URL.createObjectURL(file);
        setImagePreview(prev => ({
            ...prev,
            [index]: url
        }));
    };

    // Clean up object URLs when modal closes or image changes
    useEffect(() => {
        return () => {
            Object.values(imagePreview).forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, [isOpen]);

    const handleParentDropdown = (type, value) => {
        setParentSelections(prev => ({
            ...prev,
            [type]: {
                selectedMemberId: value === 'manual' ? null : value,
                showManualEntry: value === 'manual',
            }
        }));
    };

    const handleFormDropdown = (formIndex, value) => {
        setFormSelections(prev => ({
            ...prev,
            [formIndex]: {
                selectedMemberId: value === 'manual' ? null : value,
                showManualEntry: value === 'manual',
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Fallback: Prevent adding an already-in-tree user
        const formData = new FormData(e.target);
        let duplicate = false;
        forms.forEach(form => {
            const sel = formSelections[form.index] || {};
            if (sel.selectedMemberId && !sel.showManualEntry) {
                if (existingMemberIds.includes(parseInt(sel.selectedMemberId))) {
                    duplicate = true;
                }
            }
        });
        if (duplicate) {
            Swal.fire({ icon: 'info', title: 'Already in tree', text: 'This user is already part of the family tree.' });
            return;
        }
        // Special handling for parents: handle both father and mother
        if (action.type === 'parents') {
            const parentForms = forms.filter(f => f.type === 'father' || f.type === 'mother');
            const parentPersons = [];
            let hasValidParent = false;
            
            parentForms.forEach(form => {
                const sel = parentSelections[form.type];
                
                // Check if user has made a selection for this parent
                if (sel) {
                    if (sel.selectedMemberId && !sel.showManualEntry) {
                        // Existing member selected
                        const member = familyMembers.find(m => m.user?.id === parseInt(sel.selectedMemberId));
                        if (member) {
                            parentPersons.push({
                                name: member.user.fullName,
                                gender: member.user.userProfile.gender === 'Male' ? 'male' : 'female',
                                age: member.user.userProfile.dob ? (new Date().getFullYear() - new Date(member.user.userProfile.dob).getFullYear()) : '',
                                img: member.user.profileImage,
                                imgPreview: imagePreview[form.index] || '',
                                dob: member.user.userProfile.dob,
                                memberId: member.user.id,
                                birthOrder: 1, // Default birth order for parents,
                                lifeStatus: formData.get(`lifeStatus_${form.index}`) || member.lifeStatus || 'living',
                            });
                            hasValidParent = true;
                        }
                    } else if (sel.showManualEntry) {
                        const name = formData.get(`name_${form.index}`);
                        if (name && name.trim() !== '') {
                            parentPersons.push({
                                name: name.trim(),
                                gender: form.gender,
                                age: formData.get(`age_${form.index}`),
                                img: imageData[form.index] || '', // File object or empty string
                                imgPreview: imagePreview[form.index] || '',
                                generation: action.person ? action.person.generation - 1 : 0,
                                birthOrder: 1, // Default birth order for parents,
                                lifeStatus: formData.get(`lifeStatus_${form.index}`) || 'living',
                            });
                            hasValidParent = true;
                        }
                    }
                }
            });
            // Only proceed if we have at least one valid parent
            if (!hasValidParent) {
                Swal.fire({ icon: 'warning', title: 'Missing details', text: 'Please fill in at least one parent\'s details.' });
                return;
            }
            // 🔒 Confirmation when marking a person as "Remembering"
            const rememberingCount = parentPersons.filter(p => p.lifeStatus === 'remembering').length;
            if (rememberingCount > 0) {
                const { isConfirmed } = await Swal.fire({
                    title: 'Confirm Status',
                    icon: 'warning',
                    html: `You are about to set <b>${rememberingCount}</b> parent${rememberingCount > 1 ? 's' : ''} to <b>Remembering</b> status. Are you sure?`,
                    showCancelButton: true,
                    confirmButtonColor: PRIMARY_COLOR,
                    confirmButtonText: 'Yes, proceed',
                });
                if (!isConfirmed) return; // Abort submit
            }
            onAddPersons(parentPersons);
            onClose();
            return;
        }
        // For other types: spouse, child, sibling, etc.
        const persons = [];
        let hasValidPerson = false;
        forms.forEach(form => {
            const sel = formSelections[form.index] || {};
            // Check if user has made a selection for this person
            if (sel.selectedMemberId && !sel.showManualEntry) {
                // Existing member selected
                const member = familyMembers.find(m => m.user?.id === parseInt(sel.selectedMemberId));
                if (member) {
                    persons.push({
                        name: member.user.fullName,
                        gender: member.user.userProfile.gender === 'Male' ? 'male' : 'female',
                        age: member.user.userProfile.dob ? (new Date().getFullYear() - new Date(member.user.userProfile.dob).getFullYear()) : '',
                        img: member.user.profileImage,
                        imgPreview: imagePreview[form.index] || '',
                        dob: member.user.userProfile.dob,
                        memberId: member.user.id,
                        birthOrder: parseInt(formData.get(`birthOrder_${form.index}`)) || 1,
                        lifeStatus: formData.get(`lifeStatus_${form.index}`) || member.lifeStatus || 'living',
                    });
                    hasValidPerson = true;
                }
            } else if (sel.showManualEntry) {
                const name = formData.get(`name_${form.index}`);
                if (name && name.trim() !== '') {
                    let generation, gender;
                    if (action.type === 'children') {
                        generation = action.person ? action.person.generation + 1 : 1;
                        gender = formData.get(`gender_${form.index}`);
                    } else if (action.type === 'siblings') {
                        generation = action.person ? action.person.generation : 1;
                        gender = formData.get(`gender_${form.index}`);
                    } else if (action.type === 'spouse') {
                        generation = action.person ? action.person.generation : 1;
                        gender = formData.get(`gender_0`);
                    } else if (action.type === 'edit') {
                        generation = action.person ? action.person.generation : 1;
                        gender = formData.get(`gender_0`);
                    }
                    // --- FIX: Add id and memberId for edit ---
                    const personObj = {
                        name: name.trim(),
                        gender: gender || 'male',
                        age: formData.get(`age_${form.index}`),
                        generation,
                        img: imageData[form.index] || '', // File object or empty string
                        imgPreview: imagePreview[form.index] || '',
                        lifeStatus: formData.get(`lifeStatus_${form.index}`) || 'living',
                        birthOrder: parseInt(formData.get(`birthOrder_${form.index}`)) || 1,
                    };
                    if (action.type === 'edit' && action.person) {
                        personObj.id = action.person.id;
                        if (action.person.memberId) personObj.memberId = action.person.memberId;
                    }
                    persons.push(personObj);
                    hasValidPerson = true;
                }
            }
        });
        // Only proceed if we have at least one valid person
        if (!hasValidPerson) {
            Swal.fire({ icon: 'warning', title: 'Missing details', text: 'Please fill in at least one person\'s details.' });
            return;
        }
        // 🔒 Confirmation when marking a person as "Remembering"
        const rememberingCount = persons.filter(p => p.lifeStatus === 'remembering').length;
        if (rememberingCount > 0) {
            const { isConfirmed } = await Swal.fire({
                title: 'Confirm Status',
                icon: 'warning',
                html: `You are about to set <b>${rememberingCount}</b> new/edited person${rememberingCount > 1 ? 's' : ''} to <b>Remembering</b> status. Are you sure?`,
                showCancelButton: true,
                confirmButtonColor: PRIMARY_COLOR,
                confirmButtonText: 'Yes, proceed',
            });
            if (!isConfirmed) return; // Abort submit
        }
        onAddPersons(persons);
        onClose();
    };

    // Tab switch handler
    const handleTabSwitch = (formKey, tab) => {
        setActiveTabs(prev => ({ ...prev, [formKey]: tab }));
        if (action.type === 'parents') {
            setParentSelections(prev => ({
                ...prev,
                [formKey]: {
                    ...prev[formKey],
                    showManualEntry: tab === 'new',
                }
            }));
        } else {
            setFormSelections(prev => ({
                ...prev,
                [formKey]: {
                    ...prev[formKey],
                    showManualEntry: tab === 'new',
                }
            }));
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="modal-overlay-upgraded"
            style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '100vw', 
                height: '100vh', 
                background: 'rgba(0, 0, 0, 0.6)', 
                backdropFilter: 'blur(8px)',
                zIndex: 1000, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontFamily: 'Poppins, Arial, sans-serif',
                animation: 'modalFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }} 
            onClick={onClose}
        >
            <div 
                className="modal-content-upgraded"
                style={{ 
                    position: 'relative', 
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px) saturate(1.8)',
                    borderRadius: 24, 
                    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.25), 0 8px 32px rgba(0, 0, 0, 0.15)', 
                    maxWidth: 500, 
                    width: '95vw', 
                    maxHeight: '90vh', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: 0,
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    animation: 'modalSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }} 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div
                style={{ 
                    padding: '28px 32px 20px 32px', 
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    background: PRIMARY_COLOR,
                    borderRadius: '24px 24px 0 0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                        
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: PRIMARY_COLOR,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 15px rgba(63, 152, 44, 0.18)'

                        }}>
                            {action.type === 'parents' && <Users size={20} color="#fff" />}
                            {action.type === 'spouse' && <UserPlus size={20} color="#fff" />}
                            {action.type === 'children' && <Plus size={20} color="#fff" />}
                            {action.type === 'siblings' && <UserMinus size={20} color="#fff" />}
                            {action.type === 'edit' && <Edit size={20} color="#fff" />}
                        </div>
                        <h3 className="modal-title-upgraded" style={{ 
                            fontSize: 24, 
                            fontWeight: 700, 
                            margin: 0,
                            color: '#fff',
                            background: 'none',
                        }}>
                            {titles[action.type] || 'Add Person'}
                        </h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: 'rgba(0, 0, 0, 0.05)', 
                            border: 'none', 
                            fontSize: 20, 
                            cursor: 'pointer', 
                            color: '#fff',
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }} 
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(0, 0, 0, 0.1)';
                            e.target.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                            e.target.style.color = '#fff';
                        }}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <form onSubmit={handleSubmit} style={{ 
                    flex: 1, 
                    overflow: 'auto', 
                    padding: '24px 32px 0 32px',
                    background: 'rgba(255, 255, 255, 0.5)'
                }}>
                    {/* For parents, show two dropdowns/manuals: father and mother */}
                    {action.type === 'parents' && forms.map((form) => {
                        const eligible = getEligibleMembersWithAll(form);
                        // Default tab is 'new' (Add New)
                        const tab = activeTabs[form.type] || 'new';
                        return (
                        <div key={form.index} style={{ marginBottom: 24 }}>
                            {/* Tab Toggle: Add New first, then Select Existing */}
                            <div style={{ 
                                display: 'flex', 
                                gap: 0, 
                                marginBottom: 16, 
                                borderRadius: 12, 
                                overflow: 'hidden', 
                                border: `2px solid ${PRIMARY_COLOR}22`, 
                                width: 'fit-content', 
                                fontWeight: 600, 
                                fontSize: 14,
                                background: 'rgba(255, 255, 255, 0.8)',
                                boxShadow: `0 4px 15px ${PRIMARY_COLOR}18`
                            }}>
                                <button 
                                    type="button" 
                                    onClick={() => handleTabSwitch(form.type, 'new')} 
                                    style={{ 
                                        padding: '10px 24px', 
                                        background: tab === 'new' ? PRIMARY_COLOR : 'transparent', 
                                        color: tab === 'new' ? '#fff' : PRIMARY_COLOR, 
                                        border: 'none', 
                                        outline: 'none', 
                                        cursor: 'pointer', 
                                        transition: 'all 0.3s ease',
                                        fontWeight: 600
                                    }}
                                >
                                    Add New
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => handleTabSwitch(form.type, 'existing')} 
                                    style={{ 
                                        padding: '10px 24px', 
                                        background: tab === 'existing' ? PRIMARY_COLOR : 'transparent', 
                                        color: tab === 'existing' ? '#fff' : PRIMARY_COLOR, 
                                        border: 'none', 
                                        outline: 'none', 
                                        cursor: 'pointer', 
                                        transition: 'all 0.3s ease',
                                        fontWeight: 600
                                    }} 
                                    disabled={eligible.length === 0}
                                >
                                    Select Existing
                                </button>
                            </div>

                            {/* Existing Member Dropdown */}
                            {tab === 'existing' && eligible.length > 0 && !parentSelections[form.type]?.showManualEntry && (
                                <div className="form-group-upgraded" style={{ marginBottom: 16 }}>
                                    <label style={{ 
                                        fontWeight: 600, 
                                        color: '#333',
                                        marginBottom: 8,
                                        display: 'block'
                                    }}>
                                        Select Existing {form.type === 'father' ? 'Father' : 'Mother'}:
                                    </label>
                                    <select
                                        value={parentSelections[form.type]?.selectedMemberId || ''}
                                        onChange={e => handleParentDropdown(form.type, e.target.value)}
                                        style={{ 
                                            width: '100%', 
                                            borderRadius: 12, 
                                            border: `2px solid ${PRIMARY_COLOR}22`, 
                                            padding: '12px 16px', 
                                            background: 'rgba(255, 255, 255, 0.9)',
                                            fontSize: 14,
                                            fontWeight: 500,
                                            transition: 'all 0.3s ease',
                                            outline: 'none'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = PRIMARY_COLOR;
                                            e.target.style.boxShadow = `0 0 0 3px ${PRIMARY_COLOR}18`;
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = `${PRIMARY_COLOR}22`;
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    >
                                        <option value="">-- Select --</option>
                                        {eligible.map(member => (
                                            <option key={member.user.id} value={member.user.id} disabled={existingMemberIds.includes(member.user.id)}>
                                                {member.user.fullName} {member.user.userProfile && member.user.userProfile.gender ? `(${member.user.userProfile.gender}${member.user.userProfile.dob ? ', ' + member.user.userProfile.dob.split('T')[0] : ''})` : ''} {existingMemberIds.includes(member.user.id) ? '(Already in tree)' : ''}
                                            </option>
                                        ))}
                                        <option value="manual">Add New Member</option>
                                    </select>
                                </div>
                            )}

                            {/* Manual entry for parent if needed */}
                            {tab === 'new' && (
                                <div className="person-form-upgraded" style={{ 
                                    background: '#f6fdf7',
                                    borderRadius: 16, 
                                    padding: 24, 
                                    marginBottom: 0, 
                                    boxShadow: `0 4px 20px ${PRIMARY_COLOR}10`,
                                    border: `1px solid ${PRIMARY_COLOR}10`
                                }}>
                                    <h4 style={{ 
                                        marginBottom: 16, 
                                        fontWeight: 700, 
                                        fontSize: 18,
                                        color: '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}>
                                        {form.type === 'father' ? '👨 Father' : '👩 Mother'}
                                    </h4>
                                    <div className="form-row-upgraded" style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                        <div className="form-group-upgraded" style={{ flex: 1 }}>
                                            <label style={{ 
                                                fontWeight: 600, 
                                                color: '#333',
                                                marginBottom: 8,
                                                display: 'block'
                                            }}>
                                                Name:
                                            </label>
                                            <input 
                                                type="text" 
                                                name={`name_${form.index}`}
                                                required 
                                                style={{ 
                                                    width: '100%', 
                                                    borderRadius: 12, 
                                                    border: '2px solid rgba(102, 126, 234, 0.2)', 
                                                    padding: '12px 16px', 
                                                    background: 'rgba(255, 255, 255, 0.9)',
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    transition: 'all 0.3s ease',
                                                    outline: 'none'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#667eea';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = 'rgba(102, 126, 234, 0.2)';
                                                    e.target.style.boxShadow = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row-upgraded" style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                        <div className="form-group-upgraded" style={{ flex: 1 }}>
                                            <label style={{ 
                                                fontWeight: 600, 
                                                color: '#333',
                                                marginBottom: 8,
                                                display: 'block'
                                            }}>
                                                Age:
                                            </label>
                                            <input 
                                                type="number" 
                                                name={`age_${form.index}`}
                                                min="0"
                                                max="200"
                                                onInput={(e) => {
    // Convert to number to remove leading zeros
    let v = e.target.value;

    // If user types 00006 → Number(v) = 6
    if (v !== "") {
        v = String(Number(v));
    }

    // Apply limits
    if (v > 200) v = "200";
    if (v < 0) v = "0";

    e.target.value = v;
}}

                                                style={{ 
                                                    width: '100%', 
                                                    borderRadius: 12, 
                                                    border: '2px solid rgba(102, 126, 234, 0.2)', 
                                                    padding: '12px 16px', 
                                                    background: 'rgba(255, 255, 255, 0.9)',
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    transition: 'all 0.3s ease',
                                                    outline: 'none'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#667eea';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = 'rgba(102, 126, 234, 0.2)';
                                                    e.target.style.boxShadow = 'none';
                                                }}
                                            />
                                        </div>
                                        <div className="form-group-upgraded" style={{ flex: 1 }}>
                                            <label style={{ 
                                                fontWeight: 600, 
                                                color: '#333',
                                                marginBottom: 8,
                                                display: 'block'
                                            }}>
                                                Life Status:
                                            </label>
                                            <select 
                                                name={`lifeStatus_${form.index}`}
                                                defaultValue={(formSelections && formSelections[form.index] && !formSelections[form.index].showManualEntry)
                                                ? (familyMembers.find(m => m.user?.id === parseInt(formSelections[form.index].selectedMemberId || -1))?.lifeStatus || 'living')
                                                : 'living' }
                                                style={{ 
                                                    width: '100%', 
                                                    borderRadius: 12, 
                                                    border: '2px solid rgba(102, 126, 234, 0.2)', 
                                                    padding: '12px 16px', 
                                                    background: 'rgba(255, 255, 255, 0.9)',
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    transition: 'all 0.3s ease',
                                                    outline: 'none'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#667eea';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = 'rgba(102, 126, 234, 0.2)';
                                                    e.target.style.boxShadow = 'none';
                                                }}
                                            >
                                                <option value="living">Living</option>
                                                <option value="remembering">In Loving Memory</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row-upgraded" style={{ display: 'flex', gap: 16 }}>
                                        <div className="form-group-upgraded" style={{ flex: 1 }}>
                                            <label style={{ 
                                                fontWeight: 600, 
                                                color: '#333',
                                                marginBottom: 8,
                                                display: 'block'
                                            }}>
                                                Profile Image (optional):
                                            </label>
                                            <div style={{
                                                position: 'relative',
                                                display: 'inline-block',
                                                cursor: 'pointer'
                                            }}>
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={(e) => handleImageUpload(e, form.index)}
                                                    style={{ 
                                                        position: 'absolute',
                                                        opacity: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                                <div style={{
                                                    padding: '12px 20px',
                                                    borderRadius: 12,
                                                    border: '2px dashed rgba(102, 126, 234, 0.3)',
                                                    background: 'rgba(102, 126, 234, 0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    transition: 'all 0.3s ease',
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    color: '#667eea'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.target.style.borderColor = '#667eea';
                                                    e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.target.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                                                    e.target.style.background = 'rgba(102, 126, 234, 0.05)';
                                                }}
                                                >
                                                    <Camera size={16} />
                                                    Choose Image
                                                </div>
                                            </div>
                                            <input 
                                                type="hidden" 
                                                name={`img_data_${form.index}`}
                                                value={imageData[form.index] || ''}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );})}

                    {/* For other types: spouse, child, sibling, etc. */}
                    {action.type !== 'parents' && forms.map((form) => {
                        const eligible = getEligibleMembersWithAll(form);
                        // Default tab is 'new' (Add New)
                        const tab = activeTabs[form.index] || 'new';
                        return (
                          <div key={form.index} style={{ marginBottom: 24 }}>
                            {/* Tab Toggle: Add New first, then Select Existing */}
                            <div
                              style={{
                                display: "flex",
                                gap: 0,
                                marginBottom: 16,
                                borderRadius: 12,
                                overflow: "hidden",
                                border: `2px solid ${PRIMARY_COLOR}22`,
                                width: "fit-content",
                                fontWeight: 600,
                                fontSize: 14,
                                background: "rgba(255, 255, 255, 0.8)",
                                boxShadow: `0 4px 15px ${PRIMARY_COLOR}18`,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleTabSwitch(form.index, "new")
                                }
                                style={{
                                  padding: "10px 24px",
                                  background:
                                    tab === "new"
                                      ? PRIMARY_COLOR
                                      : "transparent",
                                  color: tab === "new" ? "#fff" : PRIMARY_COLOR,
                                  border: "none",
                                  outline: "none",
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                                  fontWeight: 600,
                                }}
                              >
                                Add New
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleTabSwitch(form.index, "existing")
                                }
                                style={{
                                  padding: "10px 24px",
                                  background:
                                    tab === "existing"
                                      ? PRIMARY_COLOR
                                      : "transparent",
                                  color:
                                    tab === "existing" ? "#fff" : PRIMARY_COLOR,
                                  border: "none",
                                  outline: "none",
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                                  fontWeight: 600,
                                }}
                                disabled={eligible.length === 0}
                              >
                                Select Existing
                              </button>
                            </div>

                            {/* Existing Member Dropdown */}
                            {tab === "existing" &&
                              eligible.length > 0 &&
                              !formSelections[form.index]?.showManualEntry && (
                                <div
                                  className="form-group-upgraded"
                                  style={{ marginBottom: 16 }}
                                >
                                  <label
                                    style={{
                                      fontWeight: 600,
                                      color: "#333",
                                      marginBottom: 8,
                                      display: "block",
                                    }}
                                  >
                                    Select Existing Member:
                                  </label>
                                  <select
                                    value={
                                      formSelections[form.index]
                                        ?.selectedMemberId || ""
                                    }
                                    onChange={(e) =>
                                      handleFormDropdown(
                                        form.index,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      borderRadius: 12,
                                      border: `2px solid ${PRIMARY_COLOR}22`,
                                      padding: "12px 16px",
                                      background: "rgba(255, 255, 255, 0.9)",
                                      fontSize: 14,
                                      fontWeight: 500,
                                      transition: "all 0.3s ease",
                                      outline: "none",
                                    }}
                                    onFocus={(e) => {
                                      e.target.style.borderColor =
                                        PRIMARY_COLOR;
                                      e.target.style.boxShadow = `0 0 0 3px ${PRIMARY_COLOR}18`;
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.borderColor = `${PRIMARY_COLOR}22`;
                                      e.target.style.boxShadow = "none";
                                    }}
                                  >
                                    <option value="">-- Select --</option>
                                    {eligible.map((member) => (
                                      <option
                                        key={member.user.id}
                                        value={member.user.id}
                                        disabled={existingMemberIds.includes(
                                          member.user.id
                                        )}
                                      >
                                        {member.user.fullName}{" "}
                                        {member.user.userProfile &&
                                        member.user.userProfile.gender
                                          ? `(${
                                              member.user.userProfile.gender
                                            }${
                                              member.user.userProfile.dob
                                                ? ", " +
                                                  member.user.userProfile.dob.split(
                                                    "T"
                                                  )[0]
                                                : ""
                                            })`
                                          : ""}{" "}
                                        {existingMemberIds.includes(
                                          member.user.id
                                        )
                                          ? "(Already in tree)"
                                          : ""}
                                      </option>
                                    ))}
                                    <option value="manual">
                                      Add New Member
                                    </option>
                                  </select>
                                </div>
                              )}

                            {/* Manual entry for other types if needed */}
                            {tab === "new" && (
                              <div
                                className="person-form-upgraded"
                                style={{
                                  background: "#f6fdf7",
                                  borderRadius: 16,
                                  marginBottom: 0,
                                  border: `1px solid ${PRIMARY_COLOR}10`,
                                }}
                              >
                                {form.type === "spouse" && (
                                  <>
                                    <h4
                                      style={{
                                        marginBottom: 16,
                                        fontWeight: 700,
                                        fontSize: 18,
                                        color: "#333",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      💕 Spouse
                                    </h4>

                                    {/* --- Mobile Invite Section --- */}
                                    <div
                                      style={{
                                        marginBottom: 20,
                                        background: "#fff",
                                        padding: 16,
                                        borderRadius: 12,
                                        border: `1px solid ${PRIMARY_COLOR}33`,
                                      }}
                                    >
                                      <label
                                        style={{
                                          fontWeight: 600,
                                          color: "#333",
                                          display: "block",
                                          marginBottom: 6,
                                        }}
                                      >
                                        Invite Spouse by Mobile Number:
                                      </label>
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <input
                                          type="text"
                                          placeholder="10-digit mobile"
                                          value={phoneInvite.phone}
                                          maxLength={10}
                                          onChange={(e) =>
                                            setPhoneInvite((p) => ({
                                              ...p,
                                              phone: e.target.value,
                                            }))
                                          }
                                          style={{
                                            flex: 1,
                                            borderRadius: 8,
                                            padding: "10px 12px",
                                            border: `2px solid ${PRIMARY_COLOR}22`,
                                            outline: "none",
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={handlePhoneSearch}
                                          disabled={
                                            !phoneRegex.test(
                                              phoneInvite.phone
                                            ) || phoneInvite.loading
                                          }
                                          style={{
                                            padding: "10px 18px",
                                            background: PRIMARY_COLOR,
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: 8,
                                            cursor: "pointer",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {phoneInvite.loading
                                            ? "Searching..."
                                            : "Search"}
                                        </button>
                                      </div>

                                      {phoneInvite.result && (
                                        <div
                                          style={{
                                            marginTop: 12,
                                            fontSize: 14,
                                          }}
                                        >
                                          {phoneInvite.result.exists ? (
                                            <>
                                              <div
                                                style={{ marginBottom: "10px" }}
                                              >
                                                <span
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  User:
                                                </span>{" "}
                                                {
                                                  phoneInvite.result.user
                                                    .firstName
                                                }{" "}
                                                {
                                                  phoneInvite.result.user
                                                    .lastName
                                                }
                                              </div>
                                              <div
                                                style={{ marginBottom: "10px" }}
                                              >
                                                <span
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  Family Code:
                                                </span>{" "}
                                                {phoneInvite.result.user
                                                  .familyCode || "N/A"}
                                              </div>
                                              {!phoneInvite.result
                                                .sameFamily && (
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    gap: "10px",
                                                    marginTop: "10px",
                                                  }}
                                                >
                                                  {/* Invite button hidden as requested */}
                                                  {/* <button 
                                                                            type="button" 
                                                                            onClick={handleSendInvite} 
                                                                            disabled={phoneInvite.sending}
                                                                            style={{ 
                                                                                padding: '8px 16px', 
                                                                                background: '#4CAF50', 
                                                                                color: '#fff', 
                                                                                border: 'none', 
                                                                                borderRadius: 8, 
                                                                                cursor: 'pointer', 
                                                                                fontWeight: 600,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '5px'
                                                                            }}
                                                                        >
                                                                            <Send size={16} />
                                                                            {phoneInvite.sending ? 'Sending...' : 'Invite'}
                                                                        </button> */}
                                                  <button
                                                    type="button"
                                                    onClick={handleSendRequest}
                                                    disabled={
                                                      phoneInvite.requesting
                                                    }
                                                    title="Request to associate family"
                                                    style={{
                                                      padding: "8px 16px",
                                                      background: "#2196F3",
                                                      color: "#fff",
                                                      border: "none",
                                                      borderRadius: 8,
                                                      cursor: "pointer",
                                                      fontWeight: 600,
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "5px",
                                                    }}
                                                  >
                                                    <UserPlus size={16} />
                                                    {phoneInvite.requesting
                                                      ? "Requesting..."
                                                      : "Request"}
                                                  </button>
                                                </div>
                                              )}
                                              {phoneInvite.result
                                                .sameFamily && (
                                                <span
                                                  style={{
                                                    color: PRIMARY_COLOR,
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Already in same family
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              <span>
                                                No Familyss account found.
                                              </span>
                                              <br />
                                              <button
                                                type="button"
                                                onClick={handleSendInvite}
                                                disabled={phoneInvite.sending}
                                                style={{
                                                  marginTop: 8,
                                                  padding: "8px 16px",
                                                  background: PRIMARY_COLOR,
                                                  color: "#fff",
                                                  border: "none",
                                                  borderRadius: 8,
                                                  cursor: "pointer",
                                                  fontWeight: 600,
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "5px",
                                                }}
                                              >
                                                <Send size={16} />
                                                {phoneInvite.sending
                                                  ? "Sending..."
                                                  : "Invite via WhatsApp"}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                                {form.type === "person" && (
                                  <h4
                                    style={{
                                      marginBottom: 16,
                                      fontWeight: 700,
                                      fontSize: 18,
                                      color: "#333",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    👤 Person {form.index + 1}
                                  </h4>
                                )}
                                <div
                                  className="form-row-upgraded"
                                  style={{
                                    display: "flex",
                                    gap: 16,
                                    marginBottom: 16,
                                  }}
                                >
                                  <div
                                    className="form-group-upgraded"
                                    style={{ flex: 1 }}
                                  >
                                    <label
                                      style={{
                                        fontWeight: 600,
                                        color: "#333",
                                        marginBottom: 8,
                                        display: "block",
                                      }}
                                    >
                                      Name:
                                    </label>
                                    <input
                                      type="text"
                                      name={`name_${form.index}`}
                                      defaultValue={
                                        action.type === "edit" && action.person
                                          ? action.person.name
                                          : ""
                                      }
                                      required
                                      style={{
                                        width: "100%",
                                        borderRadius: 12,
                                        border:
                                          "2px solid rgba(102, 126, 234, 0.2)",
                                        padding: "12px 16px",
                                        background: "rgba(255, 255, 255, 0.9)",
                                        fontSize: 14,
                                        fontWeight: 500,
                                        transition: "all 0.3s ease",
                                        outline: "none",
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = "#667eea";
                                        e.target.style.boxShadow =
                                          "0 0 0 3px rgba(102, 126, 234, 0.1)";
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor =
                                          "rgba(102, 126, 234, 0.2)";
                                        e.target.style.boxShadow = "none";
                                      }}
                                    />
                                  </div>
                                  {form.type !== "father" &&
                                    form.type !== "mother" && (
                                      <div
                                        className="form-group-upgraded"
                                        style={{ flex: 1 }}
                                      >
                                        <label
                                          style={{
                                            fontWeight: 600,
                                            color: "#333",
                                            marginBottom: 8,
                                            display: "block",
                                          }}
                                        >
                                          Gender:
                                        </label>
                                        <select
                                          name={`gender_${form.index}`}
                                          defaultValue={
                                            action.type === "edit" &&
                                            action.person
                                              ? action.person.gender
                                              : action.type === "spouse" &&
                                                action.person
                                              ? action.person.gender ===
                                                "female"
                                                ? "male"
                                                : "female"
                                              : "male"
                                          }
                                          style={{
                                            width: "100%",
                                            borderRadius: 12,
                                            border:
                                              "2px solid rgba(102, 126, 234, 0.2)",
                                            padding: "12px 16px",
                                            background:
                                              "rgba(255, 255, 255, 0.9)",
                                            fontSize: 14,
                                            fontWeight: 500,
                                            transition: "all 0.3s ease",
                                            outline: "none",
                                          }}
                                          onFocus={(e) => {
                                            e.target.style.borderColor =
                                              "#667eea";
                                            e.target.style.boxShadow =
                                              "0 0 0 3px rgba(102, 126, 234, 0.1)";
                                          }}
                                          onBlur={(e) => {
                                            e.target.style.borderColor =
                                              "rgba(102, 126, 234, 0.2)";
                                            e.target.style.boxShadow = "none";
                                          }}
                                        >
                                          <option value="male">Male</option>
                                          <option value="female">Female</option>
                                        </select>
                                      </div>
                                    )}
                                  <div
                                    className="form-group-upgraded"
                                    style={{ flex: 1 }}
                                  >
                                    <label
                                      style={{
                                        fontWeight: 600,
                                        color: "#333",
                                        marginBottom: 8,
                                        display: "block",
                                      }}
                                    >
                                      Life Status:
                                    </label>
                                    <select
                                      name={`lifeStatus_${form.index}`}
                                      defaultValue={
                                        action.type === "edit" && action.person
                                          ? action.person.lifeStatus || "living"
                                          : "living"
                                      }
                                      style={{
                                        width: "100%",
                                        borderRadius: 12,
                                        border:
                                          "2px solid rgba(102, 126, 234, 0.2)",
                                        padding: "12px 16px",
                                        background: "rgba(255, 255, 255, 0.9)",
                                        fontSize: 14,
                                        fontWeight: 500,
                                        transition: "all 0.3s ease",
                                        outline: "none",
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = "#667eea";
                                        e.target.style.boxShadow =
                                          "0 0 0 3px rgba(102, 126, 234, 0.1)";
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor =
                                          "rgba(102, 126, 234, 0.2)";
                                        e.target.style.boxShadow = "none";
                                      }}
                                    >
                                      <option value="living">Living</option>
                                      <option value="remembering">
                                        In Loving Memory
                                      </option>
                                    </select>
                                  </div>
                                </div>
                                <div
                                  className="form-row-upgraded"
                                  style={{
                                    display: "flex",
                                    gap: 16,
                                    marginBottom: 16,
                                  }}
                                >
                                  <div
                                    className="form-group-upgraded"
                                    style={{ flex: 1 }}
                                  >
                                    <label
                                      style={{
                                        fontWeight: 600,
                                        color: "#333",
                                        marginBottom: 8,
                                        display: "block",
                                      }}
                                    >
                                      Age:
                                    </label>
                                    <input
                                      type="number"
                                      name={`age_${form.index}`}
                                      min="0"
                                      max="200"
                                      defaultValue={
                                        action.type === "edit" && action.person
                                          ? action.person.age
                                          : ""
                                      }
                                      onInput={(e) => {
                                        // Convert to number to remove leading zeros
                                        let v = e.target.value;

                                        // If user types 00006 → Number(v) = 6
                                        if (v !== "") {
                                          v = String(Number(v));
                                        }

                                        // Apply limits
                                        if (v > 200) v = "200";
                                        if (v < 0) v = "0";

                                        e.target.value = v;
                                      }}
                                      style={{
                                        width: "100%",
                                        borderRadius: 12,
                                        border:
                                          "2px solid rgba(102, 126, 234, 0.2)",
                                        padding: "12px 16px",
                                        background: "rgba(255, 255, 255, 0.9)",
                                        fontSize: 14,
                                        fontWeight: 500,
                                        transition: "all 0.3s ease",
                                        outline: "none",
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = "#667eea";
                                        e.target.style.boxShadow =
                                          "0 0 0 3px rgba(102, 126, 234, 0.1)";
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor =
                                          "rgba(102, 126, 234, 0.2)";
                                        e.target.style.boxShadow = "none";
                                      }}
                                    />
                                  </div>
                                  {/* Birth Order Field for Siblings and Children */}
                                  {(action.type === "siblings" ||
                                    action.type === "children") && (
                                    <div
                                      className="form-group-upgraded"
                                      style={{ flex: 1 }}
                                    >
                                      <label
                                        style={{
                                          fontWeight: 600,
                                          color: "#333",
                                          marginBottom: 8,
                                          display: "block",
                                        }}
                                      >
                                        Birth Order:
                                      </label>
                                      <input
                                        type="number"
                                        name={`birthOrder_${form.index}`}
                                        min="1"
                                        defaultValue="1"
                                        style={{
                                          width: "100%",
                                          borderRadius: 12,
                                          border:
                                            "2px solid rgba(102, 126, 234, 0.2)",
                                          padding: "12px 16px",
                                          background:
                                            "rgba(255, 255, 255, 0.9)",
                                          fontSize: 14,
                                          fontWeight: 500,
                                          transition: "all 0.3s ease",
                                          outline: "none",
                                        }}
                                        onFocus={(e) => {
                                          e.target.style.borderColor =
                                            "#667eea";
                                          e.target.style.boxShadow =
                                            "0 0 0 3px rgba(102, 126, 234, 0.1)";
                                        }}
                                        onBlur={(e) => {
                                          e.target.style.borderColor =
                                            "rgba(102, 126, 234, 0.2)";
                                          e.target.style.boxShadow = "none";
                                        }}
                                      />
                                      <p
                                        style={{
                                          fontSize: 12,
                                          color: "#666",
                                          marginTop: 4,
                                          fontStyle: "italic",
                                        }}
                                      >
                                        Older sibling has lower number, younger
                                        sibling has higher number
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <div
                                  className="form-row-upgraded"
                                  style={{ display: "flex", gap: 16 }}
                                >
                                  <div
                                    className="form-group-upgraded"
                                    style={{ flex: 1 }}
                                  >
                                    <label
                                      style={{
                                        fontWeight: 600,
                                        color: "#333",
                                        marginBottom: 8,
                                        display: "block",
                                      }}
                                    >
                                      Profile Image (optional):
                                    </label>
                                    <div
                                      style={{
                                        position: "relative",
                                        display: "inline-block",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleImageUpload(e, form.index)
                                        }
                                        style={{
                                          position: "absolute",
                                          opacity: 0,
                                          width: "100%",
                                          height: "100%",
                                          cursor: "pointer",
                                        }}
                                      />
                                      <div
                                        style={{
                                          padding: "12px 20px",
                                          borderRadius: 12,
                                          border:
                                            "2px dashed rgba(102, 126, 234, 0.3)",
                                          background:
                                            "rgba(102, 126, 234, 0.05)",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          transition: "all 0.3s ease",
                                          fontSize: 14,
                                          fontWeight: 500,
                                          color: "#667eea",
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.borderColor =
                                            "#667eea";
                                          e.target.style.background =
                                            "rgba(102, 126, 234, 0.1)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.borderColor =
                                            "rgba(102, 126, 234, 0.3)";
                                          e.target.style.background =
                                            "rgba(102, 126, 234, 0.05)";
                                        }}
                                      >
                                        <Camera size={16} />
                                        Choose Image
                                      </div>
                                    </div>
                                    <input
                                      type="hidden"
                                      name={`img_data_${form.index}`}
                                      value={imageData[form.index] || ""}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );})}

                    {/* Modal Footer */}
                    <div className="modal-buttons-upgraded" style={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end', 
                        gap: 16, 
                        padding: '24px 0 24px 0', 
                        background: 'transparent', 
                        position: 'sticky', 
                        bottom: 0, 
                        zIndex: 2,
                        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                        marginTop: 16
                    }}>
                        <button 
                            type="button" 
                            className="btn-cancel-upgraded" 
                            style={{ 
                                background: 'rgba(0, 0, 0, 0.05)', 
                                color: '#666', 
                                borderRadius: 12, 
                                padding: '12px 24px', 
                                fontWeight: 600, 
                                border: 'none', 
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                            }} 
                            onClick={onClose}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(0, 0, 0, 0.1)';
                                e.target.style.color = '#333';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'rgba(0, 0, 0, 0.05)';
                                e.target.style.color = '#666';
                            }}
                        >
                            <ArrowLeft size={16} />
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-success-upgraded" 
                            style={{ 
                                background: SECONDARY_COLOR, 
                                color: '#fff', 
                                borderRadius: 12, 
                                padding: '12px 28px', 
                                fontWeight: 700, 
                                border: 'none', 
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                boxShadow: `0 4px 15px ${SECONDARY_COLOR}33`
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = `0 6px 20px ${SECONDARY_COLOR}44`;
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = `0 4px 15px ${SECONDARY_COLOR}33`;
                            }}
                        >
                            <Save size={16} />
                            {action.type === 'edit' ? 'Save Changes' : 'Add'}
                        </button>
                    </div>
                </form>

                <style>{`
                    @keyframes modalFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes modalSlideIn {
                        from { 
                            opacity: 0; 
                            transform: scale(0.9) translateY(20px);
                        }
                        to { 
                            opacity: 1; 
                            transform: scale(1) translateY(0);
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default AddPersonModal;