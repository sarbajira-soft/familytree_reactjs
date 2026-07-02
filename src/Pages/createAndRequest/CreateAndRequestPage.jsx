import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHistory, FaPlusCircle, FaPaperPlane, FaUserPlus, FaEdit, FaEye, FaEnvelope, FaPhone, FaTimes } from "react-icons/fa";
import Swal from "sweetalert2";
import CreateAndRequestTreeEditor from "./CreateAndRequestTreeEditor";

const CreateAndRequestPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard"); // dashboard | tree-editor
  const [selectedFamilyForTree, setSelectedFamilyForTree] = useState(null);

  // State to manage list of families
  const [families, setFamilies] = useState([
    {
      id: 1,
      familyCode: "FAM_KAP992",
      familyName: "Kapoor Family",
      familyBio: "A legacy of cinema and art from Mumbai.",
      ownerName: "Raj Kapoor",
      ownerGender: "male",
      ownerEmail: "raj@kapoor.com",
      ownerMobile: "+91 98765 43210",
      status: "pending_claim",
    },
    {
      id: 2,
      familyCode: "FAM_SHA102",
      familyName: "Sharma Family",
      familyBio: "Respected business family based in Delhi.",
      ownerName: "Amit Sharma",
      ownerGender: "male",
      ownerEmail: "amit@sharmabiz.in",
      ownerMobile: "+91 99112 23344",
      status: "claimed",
    }
  ]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form Fields State
  const [familyName, setFamilyName] = useState("");
  const [familyBio, setFamilyBio] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerGender, setOwnerGender] = useState("male");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleOpenTreeEditor = (family) => {
    setSelectedFamilyForTree(family);
    setView("tree-editor");
  };

  const handleSaveTreeDraft = (familyId, cardCount) => {
    setFamilies(families.map(f => {
      if (f.id === familyId) {
        return {
          ...f,
          familyBio: `Prepared Family Tree containing ${cardCount} members.`
        };
      }
      return f;
    }));
    setView("dashboard");
    Swal.fire({
      icon: "success",
      title: "Draft Saved",
      text: "Family tree draft has been saved locally.",
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset Form Fields
    setFamilyName("");
    familyBio("");
    setOwnerFirstName("");
    setOwnerLastName("");
    setOwnerGender("male");
    setOwnerEmail("");
    setOwnerMobile("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!familyName.trim() || !ownerFirstName.trim() || !ownerLastName.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Missing Fields",
        text: "Please fill in Family Name and Target Owner details.",
      });
      return;
    }

    const newFamily = {
      id: Date.now(),
      familyCode: `FAM_${Math.floor(100000 + Math.random() * 900000)}`,
      familyName: familyName.trim(),
      familyBio: familyBio.trim() || "Prepared Family Tree.",
      ownerName: `${ownerFirstName.trim()} ${ownerLastName.trim()}`,
      ownerGender: ownerGender,
      ownerEmail: ownerEmail.trim(),
      ownerMobile: ownerMobile.trim(),
      status: "pending_claim",
    };

    setFamilies([newFamily, ...families]);
    setIsModalOpen(false);

    Swal.fire({
      icon: "success",
      title: "Family Tree Prepared!",
      text: `Successfully initialized tree for ${newFamily.familyName}. You can now construct the tree and share the claim link.`,
    });

    // Reset Form Fields
    setFamilyName("");
    setFamilyBio("");
    setOwnerFirstName("");
    setOwnerLastName("");
    setOwnerGender("male");
    setOwnerEmail("");
    setOwnerMobile("");
  };

  if (view === "tree-editor" && selectedFamilyForTree) {
    return (
      <CreateAndRequestTreeEditor
        family={selectedFamilyForTree}
        onClose={() => setView("dashboard")}
        onSave={handleSaveTreeDraft}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 h-[calc(100vh-3.5rem)] overflow-y-auto bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header section with back button */}
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
            title="Back"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Create & Request
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Build trees for others or request a tree compilation
            </p>
          </div>
        </div>
      </div>

      {/* Main grids */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {/* CARD 1: Create tree for others */}
        <div className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-slate-850 to-slate-950 dark:from-slate-900 dark:to-slate-950 text-white rounded-2xl p-6 md:p-8 flex flex-col justify-between min-h-[260px] shadow-xl hover:shadow-2xl group transition-all duration-300 hover:-translate-y-1">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10 group-hover:scale-110 transition-transform duration-500">
            <FaPlusCircle size={200} />
          </div>

          <div className="relative z-10">
            <span className="inline-block px-2.5 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/20 text-[10px] uppercase font-bold tracking-wider rounded-full mb-4">
              Create
            </span>
            <h2 className="text-2xl text-black md:text-3xl font-bold tracking-tight mb-2">
              Create tree for others
            </h2>
            <p className="text-sm text-slate-600 max-w-sm mb-6 leading-relaxed">
              Build a complete family tree for another family from scratch.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-4 mt-auto">
            <button
              onClick={handleOpenModal}
              className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-bold text-xs tracking-wide active:scale-95 transition-all shadow-md"
            >
              Start
            </button>
            <button
              onClick={handleOpenModal}
              className="text-white hover:underline text-xs font-bold inline-flex items-center gap-1.5"
            >
              Create <span className="text-xs transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>

        {/* CARD 2: Request family tree */}
        <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[260px] shadow-lg hover:shadow-xl group transition-all duration-300 hover:-translate-y-1">
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
              <FaPaperPlane className="text-lg" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Request family tree
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Ask someone to create a tree for you.
            </p>
          </div>

          <button
            onClick={() => navigate("/pending-request")}
            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-bold inline-flex items-center gap-1.5 mt-6 self-start group"
          >
            Request <span className="text-xs transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>

        {/* CARD 3: My requests */}
        <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between min-h-[260px] shadow-lg hover:shadow-xl group transition-all duration-300 hover:-translate-y-1">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
              <FaHistory className="text-lg" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              My requests
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              View all requests you have sent.
            </p>
          </div>

          <button
            onClick={() => navigate("/pending-request")}
            className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-bold inline-flex items-center gap-1.5 mt-6 self-start group"
          >
            View <span className="text-xs transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>

      {/* List of Prepared Trees */}
      <div className="max-w-7xl mx-auto mt-10">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-5">
          Prepared Family Trees
        </h2>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {families.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No family trees prepared yet. Click "Start" under "Create tree for others" to begin.
            </div>
          ) : (
            <div className="divide-y divide-gray-150 dark:divide-slate-800">
              {families.map((family) => (
                <div
                  key={family.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-850/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded border border-gray-200 dark:border-slate-700">
                        {family.familyCode}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {family.familyName}
                      </h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          family.status === "claimed"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                        }`}
                      >
                        {family.status === "claimed" ? "Claimed" : "Pending Claim"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {family.familyBio}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">Target Owner:</span>
                        <span className="text-gray-900 dark:text-white font-medium">{family.ownerName}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">({family.ownerGender})</span>
                      </div>
                      {family.ownerEmail && (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <FaEnvelope className="text-[10px]" />
                          <span>{family.ownerEmail}</span>
                        </div>
                      )}
                      {family.ownerMobile && (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <FaPhone className="text-[10px]" />
                          <span>{family.ownerMobile}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {family.status !== "claimed" && (
                      <>
                        <button
                          onClick={() => handleOpenTreeEditor(family)}
                          className="px-3.5 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="View"
                        >
                          <FaEye className="text-xs" /> View
                        </button>
                        <button
                          onClick={() => handleOpenTreeEditor(family)}
                          className="px-3.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Edit Tree"
                        >
                          <FaEdit className="text-xs" /> Edit Tree
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CREATE CLAIM TREE MODAL (FRONTEND ONLY DUMMY FORM) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fadeIn backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-slate-800">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-blue-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaUserPlus /> Build Tree on Behalf of Someone
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-white hover:bg-blue-700/60 p-1.5 rounded-full transition-all active:scale-95"
                title="Close"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              {/* Section 1: Family Metadata */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 mb-3">
                  1. Family Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Family Name</label>
                    <input
                      type="text"
                      required
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      placeholder="E.g., The Kapoor Family"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Family Bio</label>
                    <textarea
                      value={familyBio}
                      onChange={(e) => setFamilyBio(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                      placeholder="Brief details about origins, ancestral town, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Owner/Admin Person Profile Details */}
              <div className="pt-2">
                <h3 className="text-xs uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 mb-3">
                  2. Unregistered Target Owner Details
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">First Name</label>
                      <input
                        type="text"
                        required
                        value={ownerFirstName}
                        onChange={(e) => setOwnerFirstName(e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Last Name</label>
                      <input
                        type="text"
                        required
                        value={ownerLastName}
                        onChange={(e) => setOwnerLastName(e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Gender</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-800 dark:text-gray-200">
                        <input
                          type="radio"
                          name="ownerGender"
                          value="male"
                          checked={ownerGender === "male"}
                          onChange={() => setOwnerGender("male")}
                          className="text-blue-600"
                        />
                        Male
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-800 dark:text-gray-200">
                        <input
                          type="radio"
                          name="ownerGender"
                          value="female"
                          checked={ownerGender === "female"}
                          onChange={() => setOwnerGender("female")}
                          className="text-blue-600"
                        />
                        Female
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                        placeholder="owner@example.com"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Mobile Number</label>
                      <input
                        type="text"
                        value={ownerMobile}
                        onChange={(e) => setOwnerMobile(e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-350 dark:border-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
                >
                  Create & Initialize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAndRequestPage;
