import React from 'react';
import PropTypes from 'prop-types';

import { UserPlus, Users, Edit, Trash2, Plus, User, UserMinus, Link2 } from 'lucide-react';



// Simple icon map with solid color

const iconMap = {

  'Add Parents': { icon: Users },

  'Add Spouse': { icon: UserPlus },

  'Add Child': { icon: Plus },

  'Add Sibling': { icon: UserMinus },

  'Edit': { icon: Edit },

  'Link Tree': { icon: Link2 },

  'Delete': { icon: Trash2 },

  'Unlink': { icon: UserMinus },

};



const RadialMenu = ({

    isActive = false,

    position = { x: 0, y: 0 },

    items = [],

    onItemClick = () => {},

    onClose = () => {},

} = {}) => {

    if (!isActive) return null;



    const isMobile = window.innerWidth < 600;
    const isCompactDesktop = !isMobile && items.length > 3;
    const itemWidth = isCompactDesktop ? 72 : 80;
    const itemHeight = isCompactDesktop ? 50 : 56;
    const gap = isCompactDesktop ? 8 : 10;
    const desktopColumns = isCompactDesktop ? 3 : items.length;
    const desktopRows = isCompactDesktop ? Math.ceil(items.length / desktopColumns) : 1;
    const menuWidth = isCompactDesktop
        ? (desktopColumns * itemWidth) + (gap * (desktopColumns + 1))
        : (items.length * itemWidth) + (gap * (items.length + 1));

    const padding = 8;

    

    // Calculate mobile menu height based on items

    const mobileItemsPerRow = 2;

    const mobileRows = Math.ceil(items.length / mobileItemsPerRow);

    const mobileMenuHeight = (mobileRows * (itemHeight + gap)) + (gap * 2) + 40; // Extra padding

    const menuHeight = isMobile ? mobileMenuHeight : (desktopRows * itemHeight) + (gap * (desktopRows + 1));



    let x = position.x;

    let y = position.y;



    if (isMobile) {

        // Bottom sheet for mobile with proper spacing from bottom

        // Account for mobile footer/navigation bar (typically 60-80px)

        const footerHeight = 80;

        x = window.innerWidth / 2;

        y = window.innerHeight - (mobileMenuHeight / 2) - footerHeight - 20; // Extra space for footer

        

        // Ensure menu doesn't go above viewport

        const minY = mobileMenuHeight / 2 + 20;

        y = Math.max(minY, y);

    } else {
        // Prefer showing above the click to avoid covering the card.
        const offset = 76;
        const aboveY = position.y - (menuHeight / 2) - offset;
        const belowY = position.y + (menuHeight / 2) + offset;
        const canFitAbove = aboveY - (menuHeight / 2) >= padding;
        const canFitBelow = belowY + (menuHeight / 2) <= window.innerHeight - padding;
        y = canFitAbove ? aboveY : (canFitBelow ? belowY : position.y);

        // Clamp to viewport
        x = Math.max(padding + menuWidth / 2, Math.min(x, window.innerWidth - menuWidth / 2 - padding));
        y = Math.max(padding + menuHeight / 2, Math.min(y, window.innerHeight - menuHeight / 2 - padding));

    }



    const showArrow = !isMobile;
    const placedAbove = !isMobile && y < position.y;

    return (

        <>

            {/* Overlay for outside click */}

            <button

                type="button"

                aria-label="Close menu"

                style={{

                    position: 'fixed',

                    top: 0,

                    left: 0,

                    width: '100vw',

                    height: '100vh',

                    zIndex: 999,

                    background: 'transparent',

                    border: 'none',

                    padding: 0,

                }}

                onClick={onClose}

            />

            {/* Menu itself */}

            <div

                className={isMobile ? 'radial-menu-mobile-sheet' : 'radial-menu-compact'}

                style={{

                    position: 'fixed',

                    top: `${y}px`,

                    left: `${x}px`,

                    zIndex: 1000,

                    background: 'rgba(255,255,255,0.97)',

                    border: '1px solid #e5e7eb',

                    borderRadius: isMobile ? 22 : 14,

                    boxShadow: '0 10px 26px rgba(15,23,42,0.16)',

                    padding: isMobile ? '18px 14px' : `${gap}px`,

                    display: 'grid',

                    gridTemplateColumns: isMobile

                        ? 'repeat(2, 1fr)'

                        : `repeat(${desktopColumns}, minmax(${itemWidth}px, 1fr))`,

                    flexDirection: 'row',

                    alignItems: 'center',

                    justifyContent: 'center',

                    pointerEvents: 'auto',

                    minWidth: isMobile ? '82vw' : `${menuWidth}px`,

                    maxWidth: isMobile ? '92vw' : `${menuWidth}px`,

                    minHeight: `${menuHeight}px`,

                    maxHeight: isMobile ? '70vh' : 'none',

                    transform: 'translate(-50%, -50%)',

                    gap: `${gap}px`,

                    overflowY: isMobile ? 'auto' : 'visible',

                    backdropFilter: 'blur(6px)',

                }}

            >

                {showArrow && (
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: '50%',
                            width: 12,
                            height: 12,
                            background: '#dbeafe',
                            border: '1px solid #93c5fd',
                            transform: 'translateX(-50%) rotate(45deg)',
                            boxShadow: '0 6px 14px rgba(15,23,42,0.12)',
                            bottom: placedAbove ? -6 : 'auto',
                            top: placedAbove ? 'auto' : -6,
                        }}
                    />
                )}

                {items.map((item, i) => {

                    const Icon = iconMap[item.label]?.icon || User;

                    const isDisabled = Boolean(item?.disabled);

                    let itemStyle = {

                        width: '100%',

                        height: isMobile ? 62 : itemHeight,

                        minWidth: isMobile ? 120 : itemWidth,

                        background: '#f8fafc',

                        borderRadius: 12,

                        display: 'flex',

                        flexDirection: 'column',

                        alignItems: 'center',

                        justifyContent: 'center',

                        boxShadow: '0 1px 3px rgba(15,23,42,0.08)',

                        border: '1px solid #e6edf3',

                        cursor: isDisabled ? 'not-allowed' : 'pointer',

                        transition: 'background 0.18s, box-shadow 0.18s, border 0.18s',

                        outline: 'none',

                        margin: 0,

                        padding: isMobile ? '8px 10px' : '4px 6px',

                        position: 'relative',

                        flex: isMobile ? '1' : 'none',

                        opacity: isDisabled ? 0.5 : 1,

                    };

                    return (

                        <button

                            key={item.label}

                            type="button"

                            style={itemStyle}

                            onClick={e => {

                                e.stopPropagation();

                                if (isDisabled) return;

                                onItemClick(item);

                                onClose();

                            }}

                            disabled={isDisabled}

                            aria-disabled={isDisabled}

                            onMouseEnter={e => {

                                if (isDisabled) return;

                                e.currentTarget.style.background = '#e0f2fe';

                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.14)';

                                e.currentTarget.style.border = '1.5px solid #2563eb';

                            }}

                            onMouseLeave={e => {

                                if (isDisabled) return;

                                e.currentTarget.style.background = '#f8fafc';

                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.08)';

                                e.currentTarget.style.border = '1px solid #e6edf3';

                            }}

                        >

                            <Icon size={isMobile ? 22 : 18} color={isDisabled ? "#6b7280" : "#2563eb"} style={{ marginBottom: isMobile ? 4 : 2 }} />

                            <span style={{

                                fontSize: isMobile ? 11 : 11,

                                fontWeight: 700,

                                color: '#222',

                                textAlign: 'center',

                                lineHeight: 1.15,

                                maxWidth: isMobile ? '100%' : itemWidth - 10,

                                whiteSpace: 'normal',

                                wordBreak: 'break-word',

                                overflow: 'hidden',

                                textOverflow: 'ellipsis',

                                marginTop: isMobile ? 4 : 2,

                                display: '-webkit-box',

                                WebkitLineClamp: 2,

                                WebkitBoxOrient: 'vertical',

                                minHeight: isMobile ? 22 : 24,

                                padding: '0 2px',

                            }}>{item.label}</span>

                        </button>

                    );

                })}

            </div>

        </>

    );

};


RadialMenu.propTypes = {

    isActive: PropTypes.bool,

    position: PropTypes.shape({

        x: PropTypes.number,

        y: PropTypes.number,

    }),

    items: PropTypes.arrayOf(

        PropTypes.shape({

            label: PropTypes.string.isRequired,

            disabled: PropTypes.bool,

        })

    ),

    onItemClick: PropTypes.func,

    onClose: PropTypes.func,

};



export default RadialMenu;
