import React, { useState, useEffect } from 'react';
import Layout from '../Components/Layout'; // Your existing Layout component
import FamilyView from '../Components/FamilyView'; // The new FamilyView component
import NoFamilyView from '../Components/NoFamilyView'; // The new NoFamilyView component
import { useNavigate } from 'react-router-dom';
import ProfileFormModal from '../Components/ProfileFormModal'; // Re-use for creating/editing family
import Swal from 'sweetalert2';

const FamilyHubPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('myFamily'); // Ensure 'myFamily' is highlighted in Layout
  const [familyData, setFamilyData] = useState(null); // State to hold family data, null if no family
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false); // For future "Join Family" modal

  // Placeholder for family member counts/stats
  // In a real application, you'd fetch these along with familyData or from a separate endpoint
  const [totalMembers, setTotalMembers] = useState(0);
  const [males, setMales] = useState(0);
  const [females, setFemales] = useState(0);
  const [averageAge, setAverageAge] = useState(0);

  // Simulate fetching family data (replace with actual API call)
  useEffect(() => {
    const fetchFamilyStatus = async () => {
      try {
        // --- START: Mock API Call ---
        // Replace this with your actual API call to check user's family status
        // Example: const response = await api.get('/user/family-status');

        // This is a dummy response. Uncomment the one you need for testing:
        const mockFamilyExists = true; // Set to true to simulate an existing family
        // const mockFamilyExists = false; // Set to false to simulate no family

        if (mockFamilyExists) {
          // Simulate a successful family data fetch (your provided response)
          const fetchedFamilyData = {
            id: 5,
            familyName: "Shiro Family",
            familyBio: "A close-knit group that loves adventures and making memories!",
            familyPhoto: "profile-1750322894941-209070974.png", // This would be the filename, resolve path later
            familyCode: "FAM001996",
            status: 1,
            createdBy: 64,
            createdAt: "2025-06-19T08:48:15.230Z",
            updatedAt: "2025-06-19T08:48:15.230Z"
          };
          setFamilyData(fetchedFamilyData);

          // Simulate fetching member stats (replace with actual logic/API)
          setTotalMembers(7); // Example count
          setMales(4);
          setFemales(3);
          setAverageAge(35.5);

        } else {
          setFamilyData(null); // No family found
        }
        // --- END: Mock API Call ---

      } catch (error) {
        console.error("Failed to fetch family status:", error);
        setFamilyData(null); // Assume no family if error
      }
    };

    fetchFamilyStatus();
  }, []);

  // Handlers for family creation/joining
  const handleCreateFamily = () => {
    setIsCreateFamilyModalOpen(true);
  };

  const handleJoinFamily = () => {
    // Implement logic for joining family, e.g., open a different modal
    Swal.fire({
      icon: 'info',
      title: 'Coming soon',
      text: 'Join Family functionality coming soon!',
      confirmButtonColor: '#3b82f6',
    });
  };

  const handleFamilyCreated = (newFamilyDetails) => {
    // After successful creation (e.g., via API call), update state
    // You'll likely get a full family object back from your API
    const now = new Date();
    const mockCreatedFamily = {
        id: Math.random(), // Replace with actual ID from backend
        familyName: newFamilyDetails.familyName,
        familyBio: newFamilyDetails.familyBio,
        familyPhoto: newFamilyDetails.familyPhoto, // If uploaded
        familyCode: `FAM${Math.floor(Math.random() * 10000)}`, // Replace with actual code from backend
        status: 1,
        createdBy: null, // Current user ID
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
    setFamilyData(mockCreatedFamily);
    setIsCreateFamilyModalOpen(false);
    Swal.fire({
      icon: 'success',
      title: 'Family created',
      text: `Family "${newFamilyDetails.familyName}" created successfully!`,
      confirmButtonColor: '#16a34a',
    });
  };

  // Handlers for FamilyView actions (passed down to FamilyView component)
  const handleManageMembers = () => {
    navigate('/family-members'); // Navigate to your FamilyMemberListing page
  };

  const handleEditFamily = () => {
    Swal.fire({
      icon: 'info',
      title: 'Edit Family',
      text: 'Edit family profile functionality!',
    });
    // You might want to open the same ProfileFormModal in 'edit' mode here
  };

  const handleShareFamilyCode = () => {
    navigator.clipboard.writeText(familyData.familyCode)
      .then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Copied!',
          text: `Family Code "${familyData.familyCode}" copied to clipboard!`,
          confirmButtonColor: '#16a34a',
        });
      })
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Copy failed',
          text: 'Unable to copy to clipboard. Please try manually.',
        });
      });
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="min-h-screen bg-gray-50"> {/* Light gray background for contrast */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {familyData ? (
            <FamilyView
              familyData={familyData}
              totalMembers={totalMembers}
              males={males}
              females={females}
              averageAge={averageAge}
              onManageMembers={handleManageMembers}
              onEditFamily={handleEditFamily}
              onShareFamilyCode={handleShareFamilyCode}
            />
          ) : (
            <NoFamilyView
              onCreateFamily={handleCreateFamily}
              onJoinFamily={handleJoinFamily}
              type="default"
            />
          )}
        </div>
      </div>

      {/* Modal for Creating New Family (reusing ProfileFormModal for simplicity) */}
      <ProfileFormModal // Adjust this modal to support 'family' creation
        isOpen={isCreateFamilyModalOpen}
        onClose={() => setIsCreateFamilyModalOpen(false)}
        onAddMember={handleFamilyCreated} // Renamed for clarity, implies it handles the new family data
        mode="createFamily" // A new mode prop to tell the modal what it's for
        // You'll need to update ProfileFormModal to accept `mode` and render family-specific fields
        // Or create a dedicated `CreateFamilyModal` component.
      />
      {/* You'd also have a JoinFamilyModal here if needed */}
    </Layout>
  );
};

export default FamilyHubPage;