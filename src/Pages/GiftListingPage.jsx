// GiftListingPage.js
import React, { useState, useEffect } from 'react';
import ViewProductModal from '../Components/ViewProductModal';
import BuyConfirmationModal from '../Components/BuyConfirmationModal';
import { FiEye, FiShoppingCart, FiGift, FiChevronRight, FiHeart, FiStar, FiFilter, FiLoader, FiPackage, FiTrendingUp, FiMinus, FiPlus } from 'react-icons/fi';
import { useUser } from '../Contexts/UserContext';
import RetailMain from '../Retail/index'
const GiftListingPage = () => {
    const [gifts, setGifts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
    const [selectedGift, setSelectedGift] = useState(null);
    const [wishlist, setWishlist] = useState([]);
    const [priceFilter, setPriceFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sortOption, setSortOption] = useState('featured');
    const [quantities, setQuantities] = useState({});
    const { userInfo } = useUser();
    const token = localStorage.getItem('access_token');
    const storedUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const [receiverId, setRecipientUserId] = useState(null);

    let userId = userInfo?.userId || storedUserInfo.userId;
    let familyCode = userInfo?.familyCode || storedUserInfo.familyCode;

    if (!userId && token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id;
        } catch (e) {
            console.error('Failed to decode JWT:', e);
        }
    }


    const BASE_URL = import.meta.env.VITE_API_BASE_URL;

    // Function to transform API data to match component structure
    const transformApiData = (apiData) => {
        return apiData.map(item => ({
            id: item.id.toString(),
            images: Array.isArray(item.images) && item.images.length > 0
                ? item.images
                : ['https://via.placeholder.com/400x300?text=No+Image'],
            title: item.name,
            description: item.description,
            price: parseFloat(item.price),
            stock: item.stock,
            buyLink: '#',
            rating: 4.5, // Default rating since API doesn't provide this
            category: item.category?.name || 'Other',
            categoryId: item.categoryId,
            bestSeller: item.stock > 20, // Consider items with high stock as best sellers
            status: item.status
        }));
    };

    // Fetch categories from API
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setCategoriesLoading(true);
                const response = await fetch(`${BASE_URL}/categories`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                // Filter only active categories (status: 1) if the API provides status
                const activeCategories = data.filter(category => category.status === 1 || !category.status);
                setCategories(activeCategories);
            } catch (err) {
                console.error('Error fetching categories:', err);
                // Fallback to empty array if categories API fails
                setCategories([]);
            } finally {
                setCategoriesLoading(false);
            }
        };

        fetchCategories();
    }, [BASE_URL]);

    // Fetch products from API
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${BASE_URL}/product`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Filter only active products (status: 1)
                const activeProducts = data.filter(product => product.status === 1);
                const transformedData = transformApiData(activeProducts);
                
                setGifts(transformedData);
                setError(null);
            } catch (err) {
                console.error('Error fetching products:', err);
                setError('Failed to load products. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [BASE_URL]);

    // Function to open the Quick View Modal
    const handleViewProduct = (gift) => {
        console.log('🔍 handleViewProduct called with gift:', gift);
        console.log('🔍 Setting selectedGift and opening modal');
        setSelectedGift(gift);
        setIsViewModalOpen(true);
    };

    // Function to close the Quick View Modal
    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedGift(null);
    };

    // Function to open the Buy Confirmation Modal
    const handleOpenBuyModal = (gift, quantity = 1) => {
        console.log('🔍 handleOpenBuyModal called with:', { gift: gift.title, quantity });
        console.log('🔍 Setting selectedGift and opening BuyConfirmationModal');
        setSelectedGift(gift);
        // Update the quantities state with the quantity from ViewProductModal
        setQuantities(prev => ({
            ...prev,
            [gift.id]: quantity
        }));
        console.log('🔍 Setting isBuyModalOpen to true');
        setIsBuyModalOpen(true);
        console.log('🔍 BuyConfirmationModal should now be visible');
    };

    // Function to close the Buy Confirmation Modal
    const handleCloseBuyModal = () => {
        setIsBuyModalOpen(false);
        setSelectedGift(null);
    };

    // Final purchase action (e.g., add to cart, redirect)
    const handleFinalBuy = (giftId, quantity) => {
        // Here you would implement your actual add-to-cart logic
        console.log(`Adding gift ${giftId} with quantity ${quantity} to cart.`);
        // For demonstration, we'll just log and let the modal close.
        // In a real app, you might update global cart state, show a toast notification, etc.
    };

    const toggleWishlist = (giftId) => {
        if (wishlist.includes(giftId)) {
            setWishlist(wishlist.filter(id => id !== giftId));
        } else {
            setWishlist([...wishlist, giftId]);
        }
    };

    // Quantity management functions
    const updateQuantity = (giftId, newQuantity) => {
        if (newQuantity >= 1 && newQuantity <= 10) {
            setQuantities(prev => ({
                ...prev,
                [giftId]: newQuantity
            }));
        }
    };

    const incrementQuantity = (giftId, currentStock) => {
        const currentQty = quantities[giftId] || 1;
        const maxQty = Math.min(currentStock, 10);
        if (currentQty < maxQty) {
            updateQuantity(giftId, currentQty + 1);
        }
    };

    const decrementQuantity = (giftId) => {
        const currentQty = quantities[giftId] || 1;
        if (currentQty > 1) {
            updateQuantity(giftId, currentQty - 1);
        }
    };

    const getUserAddress = () => {
        if (userInfo?.address && userInfo.address.trim()) {
            return userInfo.address;
        }
        return "Address not provided"; // Or prompt user to add address
    };

    // Filter and sort functions
    const filteredGifts = gifts.filter(gift => {
        if (priceFilter === 'under1000' && gift.price >= 1000) return false;
        if (priceFilter === '1000-3000' && (gift.price < 1000 || gift.price > 3000)) return false;
        if (priceFilter === 'over3000' && gift.price <= 3000) return false;
        if (categoryFilter && gift.category !== categoryFilter) return false;
        return true;
    });

    const sortedGifts = [...filteredGifts].sort((a, b) => {
        if (sortOption === 'price-low') return a.price - b.price;
        if (sortOption === 'price-high') return b.price - a.price;
        if (sortOption === 'rating') return b.rating - a.rating;
        // Default (featured): best sellers first, then by rating
        if (a.bestSeller && !b.bestSeller) return -1;
        if (!a.bestSeller && b.bestSeller) return 1;
        return b.rating - a.rating;
    });

    // Get unique categories from loaded gifts for fallback
    const giftCategories = [...new Set(gifts.map(gift => gift.category))].sort();

    // Loading state
    if (loading) {
        return (
            <>
                <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center py-20">
                        <FiLoader className="text-6xl text-primary animate-spin mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Loading Products...</h2>
                        <p className="text-gray-500">Please wait while we fetch the latest products for you.</p>
                    </div>
                </div>
            </>
        );
    }

    // Error state
    if (error) {
        return (
            <>
                <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center py-20">
                        <FiGift className="text-6xl text-gray-400 mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Oops! Something went wrong</h2>
                        <p className="text-gray-500 mb-6 text-center max-w-md">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <RetailMain/>
        </>
    );
};  

export default GiftListingPage;