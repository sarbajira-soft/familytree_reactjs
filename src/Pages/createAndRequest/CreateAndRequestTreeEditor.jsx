import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaMinus, FaTrash, FaUserPlus, FaTimes, FaCheck, FaMale, FaFemale, FaPen } from "react-icons/fa";
import Swal from "sweetalert2";
import { FamilyTree } from "../../utils/FamilyTree";
import { calculateHierarchicalLayout } from "../../utils/HierarchicalTreeLayout";
import HierarchicalConnections from "../../Components/FamilyTree/HierarchicalConnections";
import { FamilyTreeProvider } from "../../Contexts/FamilyTreeContext";
import { useLanguage } from "../../Contexts/LanguageContext";
import { useUser } from "../../Contexts/UserContext";
import Person from "./PersonCard";
import AddPersonCardModal from "./AddPersonCardModal";
import RadialMenu from "../../Components/FamilyTree/RadialMenu";
import UnsavedChangesModal from "./UnsavedChangesModal";


const CreateAndRequestTreeEditor = ({ family, onClose, onSave }) => {
  const { language } = useLanguage();
  const { userInfo } = useUser();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const treeCanvasRef = useRef(null);

  // We keep a revision token to force-update layouts when the tree graph is modified
  const [treeRevision, setTreeRevision] = useState(0);

  // Track unsaved changes state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Exit Confirmation Modal State
  const [exitConfirm, setExitConfirm] = useState({
    isOpen: false,
    onConfirmSave: null,
    onConfirmDiscard: null
  });

  // Initialize in-memory tree instance using production class
  const treeInstance = useMemo(() => {
    const tree = new FamilyTree();

    if (family.familyCode === "FAM_KAP992") {
      const p1 = tree.addPerson({ name: "Raj Kapoor", gender: "male", age: "60", generation: 0 }); // id 1
      const p2 = tree.addPerson({ name: "Krishna Kapoor", gender: "female", age: "58", generation: 0 }); // id 2
      const p3 = tree.addPerson({ name: "Rishi Kapoor", gender: "male", age: "36", generation: 1 }); // id 3
      const p4 = tree.addPerson({ name: "Randhir Kapoor", gender: "male", age: "38", generation: 1 }); // id 4
      const p5 = tree.addPerson({ name: "Prithviraj Kapoor", gender: "male", age: "85", generation: -1 }); // id 5

      tree.addRelation(p1.id, p2.id, "spouse");
      tree.addRelation(p1.id, p3.id, "parent-child");
      tree.addRelation(p1.id, p4.id, "parent-child");
      tree.addRelation(p5.id, p1.id, "parent-child");

      p1.role = "அப்பா (Father)";
      p2.role = "அம்மா (Mother)";
      p3.role = "மகன் (Son)";
      p4.role = "மகன் (Son)";
      p5.role = "தாத்தா (Grandfather)";
    } else if (family.familyCode === "FAM_SHA102") {
      const p1 = tree.addPerson({ name: "Amit Sharma", gender: "male", age: "32", generation: 0 }); // id 1
      const p2 = tree.addPerson({ name: "Priya Sharma", gender: "female", age: "30", generation: 0 }); // id 2
      const p3 = tree.addPerson({ name: "Anjali Sharma", gender: "female", age: "6", generation: 1 }); // id 3

      tree.addRelation(p1.id, p2.id, "spouse");
      tree.addRelation(p1.id, p3.id, "parent-child");

      p1.role = "Self";
      p2.role = "மனைவி (Wife)";
      p3.role = "மகள் (Daughter)";
    } else {
      // Default initial root node from prepared family target owner
      const p1 = tree.addPerson({
        name: family.ownerName || "Target Owner",
        gender: family.ownerGender || "male",
        age: "28",
        generation: 0
      });
      p1.role = "Self";
    }

    return tree;
  }, [family]);

  // Run the production hierarchical layout algorithm on our tree graph
  const layout = useMemo(() => {
    const _ = treeRevision;
    const res = calculateHierarchicalLayout(treeInstance);
    return res;
  }, [treeInstance, treeRevision]);

  // Zoom control state
  const [zoom, setZoom] = useState(1);

  // Interaction State
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [modal, setModal] = useState({
    isOpen: false,
    action: {}
  });

  const [radialMenu, setRadialMenu] = useState({
    isActive: false,
    position: { x: 0, y: 0 },
    items: [],
    activePersonId: null
  });

  // Construct positioned people array with layout coordinates attached directly
  const positionedPeople = useMemo(() => {
    const _ = treeRevision;
    return Array.from(treeInstance.people.values()).map((p) => {
      const pos = layout.positions.get(p.id) || { x: 100, y: 100 };
      return {
        ...p,
        x: pos.x,
        y: pos.y
      };
    });
  }, [treeInstance, layout.positions, treeRevision]);

  // Center tree coordinates in viewport exactly like FamilyTreePage
  const centerTreeInView = () => {
    if (!containerRef.current || !layout || !layout.positions || layout.positions.size === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    layout.positions.forEach((pos) => {
      minX = Math.min(minX, pos.x - 100);
      minY = Math.min(minY, pos.y - 50);
      maxX = Math.max(maxX, pos.x + 100);
      maxY = Math.max(maxY, pos.y + 50);
    });

    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;
    const memberCount = treeInstance.people.size;

    const clientWidth = containerRef.current.clientWidth;
    const clientHeight = containerRef.current.clientHeight;

    if (memberCount > 50) {
      containerRef.current.scrollLeft = minX + treeWidth / 2 - clientWidth / 2;
      containerRef.current.scrollTop = minY + treeHeight / 2 - clientHeight / 2;
    } else {
      containerRef.current.scrollLeft = minX + treeWidth / 2 - clientWidth / 2;
      containerRef.current.scrollTop = 0;
    }
  };

  // Scroll to center on mount and layout changes
  useEffect(() => {
    if (layout && layout.positions && layout.positions.size > 0) {
      const timer = setTimeout(() => {
        centerTreeInView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [layout]);

  // Intercept full page refresh or unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes in this tree draft. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept navigation links click outside the editor using capture phase
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleWindowClick = (e) => {
      const navLink = e.target.closest("a, button, li, .nav-item, [role='button']");
      if (!navLink) return;

      // Allow clicks inside the editor container or SweetAlert container
      const isInsideEditor = e.target.closest(".family-tree-editor-container") || e.target.closest(".swal2-container");

      if (!isInsideEditor) {
        e.preventDefault();
        e.stopPropagation();

        setExitConfirm({
          isOpen: true,
          onConfirmSave: () => {
            onSave(family.id, treeInstance.people.size);
          },
          onConfirmDiscard: () => {
            setHasUnsavedChanges(false);
            const href = navLink.getAttribute("href");
            if (href) {
              navigate(href);
            } else {
              setTimeout(() => {
                navLink.click();
              }, 50);
            }
          }
        });
      }
    };

    window.addEventListener("click", handleWindowClick, true);
    return () => window.removeEventListener("click", handleWindowClick, true);
  }, [hasUnsavedChanges, family, treeInstance, navigate, onSave]);

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setExitConfirm({
        isOpen: true,
        onConfirmSave: () => {
          onSave(family.id, treeInstance.people.size);
        },
        onConfirmDiscard: () => {
          onClose();
        }
      });
    } else {
      onClose();
    }
  };

  const handlePersonClick = (personId) => {
    if (selectedPersonId === personId) {
      setSelectedPersonId(null);
      setRadialMenu({
        isActive: false,
        position: { x: 0, y: 0 },
        items: [],
        activePersonId: null
      });
      return;
    }

    setSelectedPersonId(personId);

    const person = treeInstance.people.get(personId);
    if (!person) return;

    const icons = {
      "Add Parents": `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM20 10h-2V8h-2v2h-2v2h2v2h2v-2h2v-2z"/></svg>`,
      "Add Spouse": `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
      "Add Child": `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
      "Add Sibling": `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM12 10h-2v2H8v-2H6V8h2V6h2v2h2v2z"/></svg>`,
      Edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
      Delete: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    };

    const items = [];

    // Calculate missing parents
    const missingParents = [];
    const parentSet = person.parents || new Set();
    const fatherExist = Array.from(parentSet).some(id => treeInstance.people.get(id)?.gender === "male");
    const motherExist = Array.from(parentSet).some(id => treeInstance.people.get(id)?.gender === "female");
    if (!fatherExist) missingParents.push("father");
    if (!motherExist) missingParents.push("mother");

    if (missingParents.length > 0) {
      items.push({
        label: "Add Parents",
        action: () => setModal({
          isOpen: true,
          action: { type: "parents", person, missingParentTypes: missingParents }
        }),
        icon: icons["Add Parents"]
      });
    }

    // Add Spouse
    items.push({
      label: "Add Spouse",
      action: () => setModal({ isOpen: true, action: { type: "spouse", person } }),
      icon: icons["Add Spouse"]
    });

    // Add Sibling
    items.push({
      label: "Add Sibling",
      action: () => setModal({ isOpen: true, action: { type: "siblings", person } }),
      icon: icons["Add Sibling"]
    });

    // Add Child
    items.push({
      label: "Add Child",
      action: () => setModal({ isOpen: true, action: { type: "children", person } }),
      icon: icons["Add Child"]
    });

    // Edit Details
    items.push({
      label: "Edit",
      action: () => setModal({ isOpen: true, action: { type: "edit", person } }),
      icon: icons["Edit"]
    });

    // Remove Card
    if (personId !== 1 || treeInstance.people.size === 1) {
      items.push({
        label: "Remove Member",
        action: () => handleDeleteNode(personId),
        icon: icons["Delete"]
      });
    }

    setTimeout(() => {
      const personElement = document.querySelector(`[data-person-id="${personId}"]`);
      if (personElement) {
        const actionButton = personElement.querySelector(".radial-menu-button");
        const rect = actionButton
          ? actionButton.getBoundingClientRect()
          : personElement.getBoundingClientRect();

        setRadialMenu({
          isActive: true,
          position: {
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + rect.height / 2 + window.scrollY
          },
          items,
          activePersonId: personId
        });
      }
    }, 50);
  };

  const handleOpenAddModal = (type) => {
    const selectedPerson = treeInstance.people.get(selectedPersonId);
    if (!selectedPerson) return;

    setRadialMenu({
      isActive: false,
      position: { x: 0, y: 0 },
      items: [],
      activePersonId: null
    });

    setModal({
      isOpen: true,
      action: { type, person: selectedPerson }
    });
  };

  const handleRadialMenuItemClick = (item) => {
    if (item.action) {
      item.action();
    }
    setRadialMenu({
      isActive: false,
      position: { x: 0, y: 0 },
      items: [],
      activePersonId: null
    });
  };

  const handleCloseModal = () => {
    setModal({
      isOpen: false,
      action: {}
    });
  };

  const handleAddPersons = (persons) => {
    if (!persons || persons.length === 0) return;

    const { type, person: basePerson } = modal.action;

    // Special handling for edit node: update profile details
    if (type === "edit" && basePerson) {
      const existingPerson = treeInstance.people.get(basePerson.id);
      if (existingPerson && persons.length > 0) {
        existingPerson.name = persons[0].name;
        existingPerson.gender = persons[0].gender;
        existingPerson.age = persons[0].age || "";
        existingPerson.lifeStatus = persons[0].lifeStatus || "living";
        if (persons[0].img) existingPerson.img = persons[0].img;
        if (persons[0].imgPreview) existingPerson.imgPreview = persons[0].imgPreview;
        setHasUnsavedChanges(true);
      }
      setTreeRevision((prev) => prev + 1);
      setSelectedPersonId(null);
      return;
    }

    // Map incoming person data to new IDs in in-memory FamilyTree class
    const personIdMap = new Map();
    persons.forEach((personData) => {
      const personObj = treeInstance.addPerson({
        name: personData.name,
        gender: personData.gender,
        age: personData.age || "",
        lifeStatus: personData.lifeStatus || "living"
      });

      const roleLabels = {
        spouse: personData.gender === "male" ? "கணவர் (Husband)" : "மனைவி (Wife)",
        children: personData.gender === "male" ? "மகன் (Son)" : "மகள் (Daughter)",
        parents: personData.gender === "male" ? "அப்பா (Father)" : "அம்மா (Mother)",
        siblings: personData.gender === "male" ? "தம்பி (Brother)" : "தங்கை (Sister)"
      };

      if (personObj) {
        personObj.role = roleLabels[type] || "Member";
        if (personData.imgPreview) {
          personObj.imgPreview = personData.imgPreview;
        }
        personIdMap.set(personData, personObj.id);
      }
    });

    if (!basePerson) {
      setHasUnsavedChanges(true);
      setTreeRevision((prev) => prev + 1);
      return;
    }

    const basePersonInTree = treeInstance.people.get(basePerson.id);
    if (!basePersonInTree) return;

    // Hook up relationships bidirectionally matching FamilyTreePage exactly
    if (type === "parents") {
      const existingParentIds = Array.from(basePersonInTree.parents || []).map(Number);
      const incomingParentIds = persons
        .map((pData) => personIdMap.get(pData))
        .filter(Number.isFinite)
        .map(Number);

      const combinedParentIds = Array.from(new Set([...existingParentIds, ...incomingParentIds]));

      if (combinedParentIds.length > 2) {
        Swal.fire({
          icon: "warning",
          title: "Parents complete",
          text: "This child already has two parents in the tree."
        });
        return;
      }

      incomingParentIds.forEach((parentId) => {
        if (!existingParentIds.includes(parentId)) {
          treeInstance.addRelation(parentId, basePersonInTree.id, "parent-child");
        }
      });

      if (combinedParentIds.length === 2) {
        const [p1, p2] = combinedParentIds;
        if (p1 && p2) {
          treeInstance.addRelation(p1, p2, "spouse");
        }
      }
    } else if (type === "children") {
      persons.forEach((pData) => {
        const childId = personIdMap.get(pData);
        if (childId) {
          treeInstance.addRelation(basePersonInTree.id, childId, "parent-child");
          // Link to all spouses of base person
          basePersonInTree.spouses.forEach((spouseId) => {
            treeInstance.addRelation(Number(spouseId), childId, "parent-child");
          });
        }
      });
    } else if (type === "spouse") {
      const spouseId = personIdMap.get(persons[0]);
      if (spouseId) {
        treeInstance.addRelation(basePersonInTree.id, spouseId, "spouse");
      }
    } else if (type === "siblings") {
      persons.forEach((pData) => {
        const siblingId = personIdMap.get(pData);
        if (siblingId) {
          const parentIds = Array.from(basePersonInTree.parents || []).map(Number);
          if (parentIds.length > 0) {
            parentIds.forEach((pId) => {
              treeInstance.addRelation(pId, siblingId, "parent-child");
            });
          } else {
            // Auto create dummy father to bind sibling
            const dummyParent = treeInstance.addPerson({
              name: `${basePersonInTree.name}'s Father`,
              gender: "male",
              generation: basePersonInTree.generation - 1
            });
            dummyParent.role = "அப்பா (Father)";
            treeInstance.addRelation(dummyParent.id, basePersonInTree.id, "parent-child");
            treeInstance.addRelation(dummyParent.id, siblingId, "parent-child");
          }
        }
      });
    }

    setHasUnsavedChanges(true);
    setTreeRevision((prev) => prev + 1);
    setSelectedPersonId(null);
  };

  const handleDeleteNode = (personId) => {
    if (personId === 1 && treeInstance.people.size > 1) {
      Swal.fire({
        icon: "error",
        title: "Action Denied",
        text: "Cannot delete the root node if other family members exist."
      });
      return;
    }

    const person = treeInstance.people.get(personId);
    if (!person) return;

    Swal.fire({
      title: `Delete ${person.name}?`,
      text: "Are you sure you want to remove this card from the tree structure?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete"
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove bidirectional links from other people
        treeInstance.people.forEach((p) => {
          if (p.spouses) p.spouses.delete(personId);
          if (p.children) p.children.delete(personId);
          if (p.parents) p.parents.delete(personId);
          if (p.siblings) p.siblings.delete(personId);
        });
        treeInstance.people.delete(personId);
        setSelectedPersonId(null);
        setRadialMenu({
          isActive: false,
          position: { x: 0, y: 0 },
          items: [],
          activePersonId: null
        });
        setHasUnsavedChanges(true);
        setTreeRevision((prev) => prev + 1);

        Swal.fire("Deleted!", "Family card has been removed.", "success");
      }
    });
  };

  const selectedPerson = selectedPersonId ? treeInstance.people.get(selectedPersonId) : null;

  // Calculate exact canvas size based on positioned cards

  // Calculate exact canvas size based on positioned cards
  const canvasSize = useMemo(() => {
    if (!layout || !layout.positions || layout.positions.size === 0) {
      return { width: 900, height: 600 };
    }

    let maxX = 0;
    let maxY = 0;

    layout.positions.forEach((pos) => {
      // PersonCard is 160px wide, 180px high
      maxX = Math.max(maxX, pos.x + 80);
      maxY = Math.max(maxY, pos.y + 90);
    });

    const padding = 120; // safe padding around the edges
    return {
      width: Math.max(900, maxX + padding),
      height: Math.max(600, maxY + padding)
    };
  }, [layout]);

  return (
    <FamilyTreeProvider language={language}>
      <div className="family-tree-editor-container flex flex-col h-full w-full bg-[#f8fafc] dark:bg-slate-955 transition-colors duration-200 select-none overflow-hidden font-inter font-sans">
        {/* Top Header Controls */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackClick}
              className="p-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-855 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
              title="Back to Dashboard"
            >
              <FaArrowLeft className="text-sm" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white leading-none">
                  {family.familyName} Tree Editor
                </h1>
                <span className="font-mono text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase leading-none">
                  DRAFT
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                Owner: <span className="font-semibold">{family.ownerName}</span> ({family.familyCode})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPerson && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 animate-fadeIn animate-duration-150">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Selected: <span className="text-blue-600 dark:text-blue-400">{selectedPerson.name}</span>
                </span>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                <button
                  onClick={() => handleOpenAddModal("parents")}
                  className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-1"
                >
                  + Add Parents
                </button>
                <button
                  onClick={() => handleOpenAddModal("spouse")}
                  className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-1"
                >
                  + Add Spouse
                </button>
                <button
                  onClick={() => handleOpenAddModal("siblings")}
                  className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-1"
                >
                  + Add Sibling
                </button>
                <button
                  onClick={() => handleOpenAddModal("children")}
                  className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-1"
                >
                  + Add Child
                </button>
                <button
                  onClick={() => handleOpenAddModal("edit")}
                  className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-1"
                >
                  Edit Details
                </button>
                <button
                  onClick={() => handleDeleteNode(selectedPerson.id)}
                  className="text-[10px] font-extrabold text-red-500 hover:text-red-700 px-1"
                >
                  Delete
                </button>
              </div>
            )}

            <button
              onClick={() => onSave(family.id, treeInstance.people.size)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Save Draft Layout ({treeInstance.people.size} Cards)
            </button>
          </div>
        </div>

        {/* Floating Zoom Controls */}
        <div className="fixed bottom-5 right-5 z-40 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-250 dark:border-slate-700 flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="w-9 h-9 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            title="Zoom Out"
          >
            <FaMinus className="text-sm" />
          </button>

          <div className="min-w-[52px] text-center text-xs font-bold">
            {Math.round(zoom * 100)}%
          </div>

          <button
            type="button"
            onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
            className="w-9 h-9 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            title="Zoom In"
          >
            <FaPlus className="text-sm" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-3 h-9 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-xs font-semibold active:scale-95 transition-transform"
          >
            Reset
          </button>
        </div>

        {/* Tree Viewport Canvas Area */}
        <div
          ref={containerRef}
          className="custom-scrollbar flex-1 w-full h-full min-h-0 min-w-0 pt-14 sm:pt-0 bg-slate-50 dark:bg-slate-955 relative"
          style={{ overflowX: "auto", overflowY: "auto" }}
        >
          <div
            ref={treeCanvasRef}
            className="tree-canvas relative mx-auto flex flex-col items-start justify-start sm:items-center sm:justify-center"
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              minWidth: `${canvasSize.width}px`,
              minHeight: `${canvasSize.height}px`,
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              padding: "20px",
            }}
          >
            {/* Render connector path lines */}
            {layout && layout.connections.length > 0 && (
              <HierarchicalConnections
                positions={layout.positions}
                connections={layout.connections}
              />
            )}

            {/* Render absolute positioned person cards using original refactored Person component */}
            {positionedPeople.map((person) => (
              <Person
                key={person.id}
                person={person}
                isRoot={person.id === treeInstance.rootId}
                onClick={handlePersonClick}
                rootId={treeInstance.rootId}
                tree={treeInstance}
                language={language === "tamil" ? "ta" : "en"}
                isNew={false}
                isSelected={selectedPersonId === person.id}
                isHighlighted={false}
                isSearchResult={false}
                currentUserId={userInfo?.userId}
                currentFamilyId={family.familyCode}
                viewOnly={false}
              />
            ))}
          </div>
        </div>

        {/* POPUP RADIAL MENU FOR CARDS */}
        <RadialMenu
          isActive={radialMenu.isActive}
          position={radialMenu.position}
          items={radialMenu.items}
          onItemClick={handleRadialMenuItemClick}
          onClose={() =>
            setRadialMenu({
              isActive: false,
              position: { x: 0, y: 0 },
              items: [],
              activePersonId: null
            })
          }
        />

        {/* REUSE THE SAME ADD PERSON MODAL COMPONENT */}
        <AddPersonCardModal
          isOpen={modal.isOpen}
          onClose={handleCloseModal}
          action={modal.action}
          onAddPersons={handleAddPersons}
          familyCode={family.familyCode}
          token={localStorage.getItem("access_token") || ""}
          existingMemberIds={[]}
        />

        <UnsavedChangesModal
          isOpen={exitConfirm.isOpen}
          onSave={exitConfirm.onConfirmSave}
          onDiscard={exitConfirm.onConfirmDiscard}
          onCancel={() => setExitConfirm({ isOpen: false, onConfirmSave: null, onConfirmDiscard: null })}
        />
      </div>
    </FamilyTreeProvider>
  );
};

export default CreateAndRequestTreeEditor;
