import React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../Contexts/UserContext";
import ProfileFormModal from "../Components/ProfileFormModal";

const EditProfilePage = () => {
  const { userInfo, userLoading, refetchUser } = useUser();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate("/myprofile");
  };

  const handleProfileUpdated = async () => {
    try {
      await refetchUser();
    } catch (e) {
      // ignore refetch errors, navigation will still occur
    }
    navigate("/myprofile");
  };

  if (userLoading || !userInfo) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <ProfileFormModal
        isOpen={true}
        onClose={handleClose}
        mode="edit-profile"
        onUpdateProfile={handleProfileUpdated}
        variant="page"
      />
    </div>
  );
};

export default EditProfilePage;
