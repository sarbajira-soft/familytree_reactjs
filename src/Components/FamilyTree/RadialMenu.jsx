import React from 'react';
import PropTypes from 'prop-types';

import { UserPlus, Users, Edit, Trash2, Plus, User, UserMinus } from 'lucide-react';



// Simple icon map with solid color

const iconMap = {

  'Add Parents': { icon: Users },

  'Add Spouse': { icon: UserPlus },

  'Add Child': { icon: Plus },

  'Add Sibling': { icon: UserMinus },

  'Edit': { icon: Edit },

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



    const itemWidth = 90;

    const itemHeight = 60;

    const gap = 12;

    const menuWidth = items.length * (itemWidth + gap);

    const padding = 8;

    const isMobile = window.innerWidth < 600;

    

    // Calculate mobile menu height based on items

    const mobileItemsPerRow = 2;

    const mobileRows = Math.ceil(items.length / mobileItemsPerRow);

    const mobileMenuHeight = (mobileRows * (itemHeight + gap)) + (gap * 2) + 40; // Extra padding

    const menuHeight = isMobile ? mobileMenuHeight : itemHeight + 24;



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

        // Clamp to viewport

        x = Math.max(padding + menuWidth / 2, Math.min(x, window.innerWidth - menuWidth / 2 - padding));

        y = Math.max(padding + menuHeight / 2, Math.min(y, window.innerHeight - menuHeight / 2 - padding));

    }



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

                className={isMobile ? 'radial-menu-mobile-sheet' : 'radial-menu-horizontal'}

                style={{

                    position: 'fixed',

                    top: `${y}px`,

                    left: `${x}px`,

                    zIndex: 1000,

                    background: 'rgba(255,255,255,0.98)',

                    border: '1.5px solid #e5e7eb',

                    borderRadius: isMobile ? 24 : 18,

                    boxShadow: '0 6px 32px rgba(60,60,90,0.13)',

                    padding: isMobile ? '20px 16px' : `12px ${gap}px`,

                    display: isMobile ? 'grid' : 'flex',

                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'none',

                    flexDirection: isMobile ? 'none' : 'row',

                    alignItems: 'center',

                    justifyContent: 'center',

                    pointerEvents: 'auto',

                    minWidth: isMobile ? '85vw' : `${menuWidth}px`,

                    maxWidth: isMobile ? '90vw' : 'none',

                    minHeight: `${menuHeight}px`,

                    maxHeight: isMobile ? '70vh' : 'none',

                    transform: 'translate(-50%, -50%)',

                    gap: `${gap}px`,

                    overflowY: isMobile ? 'auto' : 'visible',

                }}

            >

                {items.map((item, i) => {

                    const Icon = iconMap[item.label]?.icon || User;

                    const isDisabled = Boolean(item?.disabled);

                    let itemStyle = {

                        width: isMobile ? 'auto' : itemWidth,

                        height: isMobile ? 65 : itemHeight,

                        minWidth: isMobile ? 120 : itemWidth,

                        background: '#f4f7fa',

                        borderRadius: 14,

                        display: 'flex',

                        flexDirection: 'column',

                        alignItems: 'center',

                        justifyContent: 'center',

                        boxShadow: '0 1px 4px rgba(60,60,90,0.06)',

                        border: '1px solid #e5e7eb',

                        cursor: isDisabled ? 'not-allowed' : 'pointer',

                        transition: 'background 0.18s, box-shadow 0.18s, border 0.18s',

                        outline: 'none',

                        margin: 0,

                        padding: isMobile ? '8px 12px' : '4px 6px',

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

                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(60,60,90,0.13)';

                                e.currentTarget.style.border = '1.5px solid #2563eb';

                            }}

                            onMouseLeave={e => {

                                if (isDisabled) return;

                                e.currentTarget.style.background = '#f4f7fa';

                                e.currentTarget.style.boxShadow = '0 1px 4px rgba(60,60,90,0.06)';

                                e.currentTarget.style.border = '1px solid #e5e7eb';

                            }}

                        >

                            <Icon size={isMobile ? 24 : 22} color={isDisabled ? "#6b7280" : "#2563eb"} style={{ marginBottom: isMobile ? 4 : 2 }} />

                            <span style={{

                                fontSize: isMobile ? 12 : 13,

                                fontWeight: 600,

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

                                minHeight: isMobile ? 24 : 28,

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