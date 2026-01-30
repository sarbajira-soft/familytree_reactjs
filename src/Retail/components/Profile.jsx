import React, { useEffect, useState } from 'react';
import { FiUser, FiMapPin, FiPhone, FiMail, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useRetail } from '../context/RetailContext';

const emptyAddress = {
  first_name: '',
  last_name: '',
  address_1: '',
  address_2: '',
  city: '',
  province: '',
  postal_code: '',
  country_code: 'in',
  phone: '',
};

const Profile = () => {
  const {
    user,
    loading,
    updateCustomerProfile,
    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,
    refreshCustomerProfile,
  } = useRetail();

  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileMessage, setProfileMessage] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  useEffect(() => {
    if (!user) return;

    setProfileForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
    });

    const currentAddresses = Array.isArray(user.addresses) ? user.addresses : [];
    setAddresses(currentAddresses);
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStartEditProfile = () => {
    if (!user) return;
    setProfileError(null);
    setProfileMessage(null);
    setProfileForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
    });
    setIsEditingProfile(true);
  };

  const handleProfileCancel = () => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
      });
    }
    setProfileError(null);
    setProfileMessage(null);
    setIsEditingProfile(false);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      await updateCustomerProfile({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        phone: profileForm.phone,
      });
      await refreshCustomerProfile();
      setProfileMessage('Profile updated successfully.');
      setIsEditingProfile(false);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddressForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressClear = () => {
    setAddressForm(emptyAddress);
  };

  const handleEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setIsAddingAddress(true);
    setAddressForm({
      first_name: addr.first_name || '',
      last_name: addr.last_name || '',
      address_1: addr.address_1 || '',
      address_2: addr.address_2 || '',
      city: addr.city || '',
      province: addr.province || '',
      postal_code: addr.postal_code || '',
      country_code: addr.country_code || 'in',
      phone: addr.phone || '',
    });
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddress);
    setIsAddingAddress(false);
  };

  const handleAddressCancel = () => {
    resetAddressForm();
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setAddressSaving(true);
    setAddressError(null);

    try {
      let nextAddresses;
      if (editingAddressId) {
        const updated = await updateCustomerAddress(editingAddressId, addressForm);
        nextAddresses = updated;
      } else {
        const updated = await addCustomerAddress(addressForm);
        nextAddresses = updated;
      }
      setAddresses(Array.isArray(nextAddresses) ? nextAddresses : []);
      resetAddressForm();
    } catch (err) {
      setAddressError(err.message || 'Failed to save address');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (addrId) => {
    if (!user) return;

    setAddressSaving(true);
    setAddressError(null);

    try {
      const updated = await deleteCustomerAddress(addrId);
      setAddresses(Array.isArray(updated) ? updated : []);
      if (editingAddressId === addrId) {
        resetAddressForm();
      }
    } catch (err) {
      setAddressError(err.message || 'Failed to delete address');
    } finally {
      setAddressSaving(false);
    }
  };

  // if (!user) {
  //   return (
  //     <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-xs text-gray-600">
  //       <FiUser className="mb-3 text-4xl text-gray-300" />
  //       <p className="font-semibold text-gray-800">Sign in to manage your profile</p>
  //       <p className="mt-1 max-w-xs text-xs text-gray-500">
  //         Create an account or sign in from the header to update your details and manage saved address.
  //       </p>
  //     </section>
  //   );
  // }

  const disabled = profileSaving || addressSaving || loading;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <FiMapPin />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Address</h2>
              <p className="text-[11px] text-gray-500">Manage your saved shipping and billing address.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setAddressForm(emptyAddress);
                setEditingAddressId(null);
                setIsAddingAddress(true);
              }}
              disabled={addressSaving}
              className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 sm:w-auto"
            >
              <FiPlus className="text-[11px]" /> Add address
            </button>
          </div>
        </div>

        {addressError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {addressError}
          </div>
        )}

        <div className="text-xs">
            {addresses.length === 0 && (
              <p className="text-[11px] text-gray-500">No address saved yet. Add one below to use during checkout.</p>
            )}
            {addresses.length > 0 && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="flex h-full items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2"
                  >
                    <div className="text-[11px] text-gray-700">
                      <p className="font-semibold text-gray-900">
                        {(addr.first_name || addr.last_name) && (
                          <>
                            {addr.first_name} {addr.last_name}
                          </>
                        )}
                      </p>
                      <p>{addr.address_1}</p>
                      {addr.address_2 && <p>{addr.address_2}</p>}
                      <p>
                        {[addr.city, addr.province, addr.postal_code].filter(Boolean).join(', ')}
                      </p>
                      {addr.country_code && <p className="uppercase">{addr.country_code}</p>}
                      {addr.phone && <p>{addr.phone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditAddress(addr)}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 hover:border-blue-400 hover:text-blue-600"
                        disabled={addressSaving}
                      >
                        <FiEdit2 className="text-[10px]" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
                        disabled={addressSaving}
                      >
                        <FiTrash2 className="text-[10px]" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {(isAddingAddress || editingAddressId) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg">
              <form onSubmit={handleAddressSubmit} className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-800">
                    <FiPlus className="text-orange-500" />
                    <span>{editingAddressId ? 'Edit address' : 'Add new address'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700">First name</label>
                    <input
                      name="first_name"
                      value={addressForm.first_name}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700">Last name</label>
                    <input
                      name="last_name"
                      value={addressForm.last_name}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-700">Address</label>
                    <input
                      name="address_1"
                      value={addressForm.address_1}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700">City</label>
                    <input
                      name="city"
                      value={addressForm.city}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700">State / Province</label>
                    <input
                      name="province"
                      value={addressForm.province}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700">Postal code</label>
                    <input
                      name="postal_code"
                      value={addressForm.postal_code}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700">Country code</label>
                    <input
                      name="country_code"
                      value={addressForm.country_code}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs uppercase focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-700">Phone</label>
                    <input
                      name="phone"
                      value={addressForm.phone}
                      onChange={handleAddressChange}
                      disabled={addressSaving}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!editingAddressId && (
                      <button
                        type="button"
                        onClick={handleAddressClear}
                        disabled={addressSaving}
                        className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-800 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddressCancel}
                      disabled={addressSaving}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-800 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addressSaving}
                      className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
                    >
                      {addressSaving ? 'Saving address...' : editingAddressId ? 'Update address' : 'Add address'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Profile;
