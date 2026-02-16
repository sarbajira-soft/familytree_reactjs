// Components/ViewProductModal.js
import React, { useState, useEffect } from 'react';
import { 
    FiX, 
    FiShoppingCart, 
    FiChevronLeft, 
    FiChevronRight, 
    FiStar, 
    FiPackage, 
    FiTruck, 
    FiShield, 
    FiCheckCircle,
    FiMinus,
    FiPlus,
    FiEye,
    FiTag
} from 'react-icons/fi';

const ViewProductModal = ({ isOpen, onClose, gift, onBuyNow, initialQuantity = 1 }) => {
    console.log('🔍 ViewProductModal props:', { isOpen, gift: gift?.title, initialQuantity });
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [quantity, setQuantity] = useState(initialQuantity);
    const [isZoomed, setIsZoomed] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof onClose !== 'function') return;
        if (!window.__appModalBackStack) window.__appModalBackStack = [];

        const handler = () => {
            onClose();
        };

        window.__appModalBackStack.push(handler);

        return () => {
            const stack = window.__appModalBackStack;
            if (!Array.isArray(stack)) return;
            const idx = stack.lastIndexOf(handler);
            if (idx >= 0) stack.splice(idx, 1);
        };
    }, [isOpen, onClose]);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setCurrentImageIndex(0);
            setQuantity(initialQuantity);
        }
    }, [isOpen, initialQuantity]);

    // If the modal isn't open or no gift data is provided, don't render anything
    if (!isOpen || !gift) {
        console.log('🔍 ViewProductModal early return:', { isOpen, hasGift: !!gift });
        return null;
    }

    const imagesToDisplay = gift.images && gift.images.length > 0
        ? gift.images
        : (gift.image ? [gift.image] : []);

    const handlePrevImage = () => {
        setCurrentImageIndex((prevIndex) =>
            prevIndex === 0 ? imagesToDisplay.length - 1 : prevIndex - 1
        );
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prevIndex) =>
            prevIndex === imagesToDisplay.length - 1 ? 0 : prevIndex + 1
        );
    };

    const incrementQuantity = () => {
        if (quantity < Math.min(gift.stock, 10)) {
            setQuantity(quantity + 1);
        }
    };

    const decrementQuantity = () => {
        if (quantity > 1) {
            setQuantity(quantity - 1);
        }
    };

    const totalPrice = gift.price * quantity;

    console.log('🔍 ViewProductModal rendering with gift:', gift.title);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-3 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-300 z-20 shadow-lg hover:shadow-xl"
                    aria-label="Close"
                >
                    <FiX size={24} />
                </button>

                <div className="flex flex-col lg:flex-row h-full overflow-hidden">
                    {/* Product Image Section */}
                    <div className="lg:w-1/2 p-6 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                        {/* Main Image Display */}
                        <div className="flex-1 flex items-center justify-center relative mb-4 min-h-0">
                            {imagesToDisplay.length > 0 ? (
                                <div className="relative group w-full h-full flex items-center justify-center">
                                    <img
                                        src={imagesToDisplay[currentImageIndex]}
                                        alt={`${gift.title} image ${currentImageIndex + 1}`}
                                        className={`max-h-[400px] max-w-full object-contain rounded-2xl shadow-2xl transition-all duration-500 ${
                                            isZoomed ? 'scale-110' : 'group-hover:scale-105'
                                        }`}
                                        onError={(e) => {
                                            e.target.src = 'https://placehold.co/600x400?text=No+Image';
                                        }}
                                    />
                                    
                                    {/* Zoom overlay */}
                                    <div 
                                        className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 rounded-2xl cursor-zoom-in"
                                        onClick={() => setIsZoomed(!isZoomed)}
                                    >
                                        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <FiEye size={16} className="text-gray-600" />
                                        </div>
                                    </div>

                                    {/* Navigation arrows */}
                                    {imagesToDisplay.length > 1 && (
                                        <>
                                            <button
                                                onClick={handlePrevImage}
                                                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg text-gray-700 hover:bg-white hover:text-gray-900 transition-all duration-300 hover:shadow-xl"
                                                aria-label="Previous image"
                                            >
                                                <FiChevronLeft size={24} />
                                            </button>
                                            <button
                                                onClick={handleNextImage}
                                                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg text-gray-700 hover:bg-white hover:text-gray-900 transition-all duration-300 hover:shadow-xl"
                                                aria-label="Next image"
                                            >
                                                <FiChevronRight size={24} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-gray-400 text-center">
                                    <FiPackage size={80} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-lg">No image available</p>
                                </div>
                            )}
                        </div>

                        {/* Image Gallery Thumbnails */}
                        {imagesToDisplay.length > 1 && (
                            <div className="flex gap-3 justify-center overflow-x-auto pb-2">
                                {imagesToDisplay.map((image, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentImageIndex(index)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                                            index === currentImageIndex 
                                                ? 'border-primary-500 shadow-lg' 
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <img
                                            src={image}
                                            alt={`Thumbnail ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.src = 'https://placehold.co/100x100?text=No+Image';
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Image counter */}
                        {imagesToDisplay.length > 1 && (
                            <div className="text-center mt-2">
                                <span className="text-sm text-gray-600 font-medium">
                                    {currentImageIndex + 1} of {imagesToDisplay.length}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Product Details Section */}
                    <div className="lg:w-1/2 flex flex-col bg-white overflow-hidden">
                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                            {/* Header with category */}
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                                    <FiTag size={14} className="mr-1" />
                                    {gift.category}
                                </span>
                                {gift.bestSeller && (
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-sm font-semibold">
                                        <FiStar size={14} className="mr-1" />
                                        Best Seller
                                    </span>
                                )}
                            </div>

                            {/* Product Title */}
                            <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                                {gift.title}
                            </h2>

                            {/* Price Section */}
                            <div className="space-y-2">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-bold text-primary-600">
                                        ₹{gift.price.toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-lg font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                                        20% OFF
                                    </span>
                                </div>
                                <p className="text-gray-600">Inclusive of all taxes</p>
                            </div>

                            {/* Stock Status */}
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                                    gift.stock > 10 
                                        ? 'bg-green-100 text-green-700' 
                                        : gift.stock > 0 
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-red-100 text-red-700'
                                }`}>
                                    <FiCheckCircle size={16} />
                                    <span className="font-semibold">
                                        {gift.stock > 10 
                                            ? `${gift.stock} units in stock` 
                                            : gift.stock > 0 
                                                ? `Only ${gift.stock} left`
                                                : 'Out of stock'
                                        }
                                    </span>
                                </div>
                            </div>

                            {/* Redesigned Quantity Selector */}
                            {gift.stock > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-lg font-semibold text-gray-700">
                                            Quantity
                                        </label>
                                        <span className="text-lg text-gray-600">
                                            Total: <span className="font-bold text-primary-600">₹{totalPrice.toLocaleString('en-IN')}</span>
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center bg-gray-50 rounded-2xl p-2 shadow-inner">
                                            <button
                                                onClick={decrementQuantity}
                                                disabled={quantity <= 1}
                                                className="w-12 h-12 rounded-xl bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                                            >
                                                <FiMinus size={20} className="text-gray-600" />
                                            </button>
                                            <span className="px-6 py-3 text-2xl font-bold text-gray-800 min-w-[80px] text-center">
                                                {quantity}
                                            </span>
                                            <button
                                                onClick={incrementQuantity}
                                                disabled={quantity >= Math.min(gift.stock, 10)}
                                                className="w-12 h-12 rounded-xl bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                                            >
                                                <FiPlus size={20} className="text-gray-600" />
                                            </button>
                                        </div>
                                        
                                        <div className="text-sm text-gray-500">
                                            Max: {Math.min(gift.stock, 10)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Product Description */}
                            <div className="space-y-3">
                                <h3 className="text-xl font-semibold text-gray-900">Description</h3>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-gray-700 leading-relaxed text-base">
                                        {gift.description}
                                    </p>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <FiTruck className="text-primary-600" size={20} />
                                    <div>
                                        <p className="font-semibold text-gray-900">Free Shipping</p>
                                        <p className="text-sm text-gray-600">On orders above ₹500</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                    <FiShield className="text-primary-600" size={20} />
                                    <div>
                                        <p className="font-semibold text-gray-900">Secure Payment</p>
                                        <p className="text-sm text-gray-600">100% secure checkout</p>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Product Information */}
                            <div className="space-y-3">
                                <h3 className="text-xl font-semibold text-gray-900">Product Details</h3>
                                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Product ID:</span>
                                        <span className="font-medium text-gray-900">#{gift.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Category:</span>
                                        <span className="font-medium text-gray-900">{gift.category}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Availability:</span>
                                        <span className={`font-medium ${
                                            gift.stock > 10 ? 'text-green-600' : 
                                            gift.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                            {gift.stock > 0 ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Return Policy */}
                            <div className="space-y-3">
                                <h3 className="text-xl font-semibold text-gray-900">Return Policy</h3>
                                <div className="bg-blue-50 rounded-xl p-4">
                                    <p className="text-blue-800 text-sm leading-relaxed">
                                        Easy returns within 30 days of delivery. If you're not completely satisfied with your purchase, 
                                        you can return it for a full refund or exchange. Contact our customer support for assistance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons - Fixed at bottom */}
                        <div className="p-6 lg:p-8 border-t border-gray-200 bg-white">
                            <div className="space-y-4">
                                <button
                                    onClick={() => { 
                                        console.log('🔍 Buy Now button clicked in ViewProductModal');
                                        console.log('🔍 Calling onBuyNow with:', { gift: gift.title, quantity });
                                        onBuyNow(gift, quantity); 
                                        console.log('🔍 Closing ViewProductModal');
                                        // onClose(); 
                                    }}
                                    disabled={gift.stock <= 0}
                                    className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-xl font-bold transition-all duration-300 transform hover:scale-[1.02] ${
                                        gift.stock > 0
                                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg hover:shadow-xl hover:from-primary-700 hover:to-primary-800'
                                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    }`}
                                >
                                    <FiShoppingCart size={24} />
                                    {gift.stock > 0 ? `Buy Now - ₹${totalPrice.toLocaleString('en-IN')}` : 'Sold Out'}
                                </button>
                                
                                {gift.stock > 0 && (
                                    <p className="text-center text-sm text-gray-500">
                                        <FiCheckCircle className="inline mr-1 text-green-500" size={14} />
                                        Secure checkout • Free returns • 24/7 support
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewProductModal;