// src/components/FamilyMemberModal.jsx
import React, { useState, useEffect } from 'react';

const FamilyMemberModal = ({ isOpen, onClose, onSave, mode, initialNodeData, selfNode }) => {
    if (!isOpen) return null;

    // State for form fields
    const [name, setName] = useState('');
    const [photo, setPhoto] = useState('');
    const [gender, setGender] = useState('Unknown');

    const [fatherName, setFatherName] = useState('');
    const [fatherPhoto, setFatherPhoto] = useState('');
    const [motherName, setMotherName] = useState('');
    const [motherPhoto, setMotherPhoto] = useState('');
    const [siblings, setSiblings] = useState([]); // Array of {name, photo, gender}

    const [spouseName, setSpouseName] = useState('');
    const [spousePhoto, setSpousePhoto] = useState('');
    const [spouseGender, setSpouseGender] = useState('Female'); // Default for spouse

    const [children, setChildren] = useState([]); // Array of {name, photo, gender}

    useEffect(() => {
        // Reset all fields when modal opens/changes mode
        setName('');
        setPhoto('');
        setGender('Unknown');
        setFatherName('');
        setFatherPhoto('');
        setMotherName('');
        setMotherPhoto('');
        setSiblings([]);
        setSpouseName('');
        setSpousePhoto('');
        setSpouseGender('Female');
        setChildren([]);

        // Pre-fill fields based on mode and initialNodeData
        if (initialNodeData) {
            // For 'edit' mode, pre-fill current node's details
            if (mode === 'edit') {
                setName(initialNodeData.name || '');
                setPhoto(initialNodeData.photo || '');
                setGender(initialNodeData.gender || 'Unknown');
            }

            // Pre-fill spouse if exists for 'edit' or 'add-child-or-partner'
            // NOTE: selfNode is the entire treeData array passed from FamilyTreePage
            const spouse = initialNodeData.spouseId ? selfNode?.find(n => n.id === initialNodeData.spouseId) : null;
            if (spouse) {
                setSpouseName(spouse.name || '');
                setSpousePhoto(spouse.photo || '');
                setSpouseGender(spouse.gender || 'Female');
            }

            // Pre-fill children if exists for 'edit' or 'add-child-or-partner'
            // This logic assumes children are directly linked via childrenIds in initialNodeData
            // For this flat structure, you'd need to pass actual child objects or their IDs
            // For simplicity, we won't pre-fill children for now, only allow adding new ones.
        }

        // If adding parents to 'Self' or another node, pre-fill 'Self's' info if needed
        if (mode === 'add-parents' && initialNodeData) {
            // This modal is for adding parents *to* the initialNodeData (e.g., Father, Mother)
            // So, we'd show fields for their parents (grandparents)
            // No need to prefill spouse/children fields here
        }

    }, [isOpen, mode, initialNodeData, selfNode]); // Depend on isOpen and mode to reset/prefill

    const handleAddSibling = () => setSiblings([...siblings, { name: '', photo: '', gender: 'Unknown' }]);
    const handleSiblingChange = (index, field, value) => {
        const newSiblings = [...siblings]; newSiblings[index][field] = value; setSiblings(newSiblings);
    };
    const handleRemoveSibling = (index) => {
        const newSiblings = [...siblings]; newSiblings.splice(index, 1); setSiblings(newSiblings);
    };

    const handleAddChild = () => setChildren([...children, { name: '', photo: '', gender: 'Unknown' }]);
    const handleChildChange = (index, field, value) => {
        const newChildren = [...children]; newChildren[index][field] = value; setChildren(newChildren);
    };
    const handleRemoveChild = (index) => {
        const newChildren = [...children]; newChildren.splice(index, 1); setChildren(newChildren);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = {
            name: name, // Only used in 'edit' mode
            photo: photo, // Only used in 'edit' mode
            gender: gender, // Only used in 'edit' mode
            fatherName, fatherPhoto, motherName, motherPhoto,
            siblings,
            spouseName, spousePhoto, spouseGender,
            children,
        };
        onSave(formData);
    };

    const getModalTitle = () => {
        if (mode === 'add-self') return 'Tell Us About Yourself';
        if (mode === 'add-family' && initialNodeData?.attributes?.isSelf) return 'Add Your Family Members';
        if (mode === 'add-parents') return `Add Parents for ${initialNodeData?.name || 'this person'}`;
        if (mode === 'add-child-or-partner') return `Add Family for ${initialNodeData?.name || 'this person'}`;
        if (mode === 'edit') return `Edit ${initialNodeData?.name || 'Member'} Details`;
        return 'Family Member Details';
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-start sm:items-center justify-center z-50 px-2 sm:px-4 pt-8 pb-24 sm:pt-4 sm:pb-6">
            <div className="bg-white rounded-2xl sm:rounded-lg shadow-xl w-full max-w-md relative animate-fade-in-up overflow-hidden"
                 style={{ maxHeight: "calc(100vh - 140px)" }}>
                 <div className="h-full overflow-y-auto p-4 sm:p-6 custom-scrollbar animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">{getModalTitle()}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Section for editing current node's details */}
                        {mode === 'edit' && (
                            <div className="border p-4 rounded-md bg-purple-50">
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Edit Member Details</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                    <label className="block text-sm font-medium text-gray-700 mt-2">Photo URL</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={photo}
                                        onChange={(e) => setPhoto(e.target.value)}
                                    />
                                    <label className="block text-sm font-medium text-gray-700 mt-2">Gender</label>
                                    <select
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                    >
                                        <option value="Unknown">Unknown</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Section for adding Parents (Grandparents if clicked on a parent) */}
                        {(mode === 'add-family' && initialNodeData?.attributes?.isSelf) || mode === 'add-parents' ? (
                            <div className="border p-4 rounded-md bg-blue-50">
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                    {mode === 'add-parents' ? `Parents of ${initialNodeData?.name}` : 'Your Parents'}
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Father's Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={fatherName}
                                        onChange={(e) => setFatherName(e.target.value)}
                                    />
                                    <label className="block text-sm font-medium text-gray-700 mt-2">Father's Photo URL</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={fatherPhoto}
                                        onChange={(e) => setFatherPhoto(e.target.value)}
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700">Mother's Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={motherName}
                                        onChange={(e) => setMotherName(e.target.value)}
                                    />
                                    <label className="block text-sm font-medium text-gray-700 mt-2">Mother's Photo URL</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={motherPhoto}
                                        onChange={(e) => setMotherPhoto(e.target.value)}
                                    />
                                </div>

                                {/* Siblings of the current person (if adding parents to self) */}
                                {mode === 'add-family' && initialNodeData?.attributes?.isSelf && (
                                    <div className="mt-4 border-t pt-4">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Your Siblings</h3>
                                        {siblings.map((sibling, index) => (
                                            <div key={index} className="flex items-end space-x-2 mb-2">
                                                <div className="flex-grow">
                                                    <label className="block text-xs font-medium text-gray-600">Name</label>
                                                    <input
                                                        type="text"
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                        value={sibling.name}
                                                        onChange={(e) => handleSiblingChange(index, 'name', e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex-grow">
                                                    <label className="block text-xs font-medium text-gray-600">Photo URL</label>
                                                    <input
                                                        type="text"
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                        value={sibling.photo}
                                                        onChange={(e) => handleSiblingChange(index, 'photo', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600">Gender</label>
                                                    <select
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                        value={sibling.gender}
                                                        onChange={(e) => handleSiblingChange(index, 'gender', e.target.value)}
                                                    >
                                                        <option value="Unknown">Unknown</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                    </select>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveSibling(index)} className="bg-red-500 text-white p-2 rounded-md text-sm">Remove</button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={handleAddSibling} className="mt-2 bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600">Add Sibling</button>
                                    </div>
                                )}
                            </div>
                        ) : null}


                        {/* Section for Spouse (if applicable) */}
                        {mode !== 'add-parents' && ( // Don't show spouse if adding parents to a node
                            <div className="border p-4 rounded-md bg-green-50">
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Spouse Information</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Spouse's Name</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={spouseName}
                                        onChange={(e) => setSpouseName(e.target.value)}
                                    />
                                    <label className="block text-sm font-medium text-gray-700 mt-2">Spouse's Photo URL</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={spousePhoto}
                                        onChange={(e) => setSpousePhoto(e.target.value)}
                                    />
                                    <label className="block text-sm font-medium text-gray-700 mt-2">Spouse's Gender</label>
                                    <select
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={spouseGender}
                                        onChange={(e) => setSpouseGender(e.target.value)}
                                    >
                                        <option value="Female">Female</option>
                                        <option value="Male">Male</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        )}


                        {/* Section for Children */}
                        {mode !== 'add-parents' && ( // Don't show children if adding parents to a node
                            <div className="border p-4 rounded-md bg-yellow-50">
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Children Information</h3>
                                {children.map((child, index) => (
                                    <div key={index} className="flex items-end space-x-2 mb-2">
                                        <div className="flex-grow">
                                            <label className="block text-xs font-medium text-gray-600">Name</label>
                                            <input
                                                type="text"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                value={child.name}
                                                onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-grow">
                                            <label className="block text-xs font-medium text-gray-600">Photo URL</label>
                                            <input
                                                type="text"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                value={child.photo}
                                                onChange={(e) => handleChildChange(index, 'photo', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600">Gender</label>
                                            <select
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                                value={child.gender}
                                                onChange={(e) => handleChildChange(index, 'gender', e.target.value)}
                                            >
                                                <option value="Unknown">Unknown</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveChild(index)} className="bg-red-500 text-white p-2 rounded-md text-sm">Remove</button>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddChild} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Add Child</button>
                            </div>
                        )}


                        <div className="flex justify-end space-x-4 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition duration-200"
                            >
                                Save Family
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default FamilyMemberModal;
