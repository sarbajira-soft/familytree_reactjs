// src/components/MemberCard.jsx
import React from 'react';

const MemberCard = React.forwardRef(({ member, onNodeClick }, ref) => (
    <div
        ref={ref}
        className="flex flex-col items-center justify-center p-2 relative z-10 cursor-pointer"
        onClick={() => onNodeClick(member)}
    >
        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-md mb-2 flex-shrink-0">
            <img
                src={member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=e2e8f0&color=475569&bold=true&size=100`}
                alt={member.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.onerror = null; e.target.src=`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=e2e8f0&color=475569&bold=true&size=100`; }}
            />
        </div>
        <div className={`px-4 py-1 rounded-md text-white font-semibold text-sm whitespace-nowrap ${member.color || 'bg-gray-500'} shadow-md`}>
            {member.name}
        </div>
        {/* Plus icon for adding more family members */}
        <button
            onClick={(e) => { e.stopPropagation(); onNodeClick(member); }} // Stop propagation to prevent parent click
            className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold shadow-lg hover:bg-blue-600 transition-colors duration-200"
            title="Add family members"
        >
            +
        </button>
    </div>
));

// PHASE 3 OPTIMIZATION: Memoize MemberCard to prevent unnecessary re-renders
export default React.memo(MemberCard);
