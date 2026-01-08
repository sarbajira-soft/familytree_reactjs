import React, { useState, useEffect, useRef } from 'react';
import CreatePostModal from '../Components/CreatePostModal';
import PostViewerModal from '../Components/PostViewerModal';
import { useUser } from '../Contexts/UserContext';
import {jwtDecode} from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

import {
    FiImage, FiEdit3, FiTrash2, FiGlobe, FiUsers, FiPlusCircle, FiFeather, FiSearch, FiBell,
    FiCalendar, FiMapPin
} from 'react-icons/fi';
import { FaRegHeart, FaHeart, FaCommentDots, FaShareAlt } from 'react-icons/fa';
import { MdPublic, MdPeople } from 'react-icons/md';
import { caption } from 'framer-motion/client';


const PostsAndFeedsPage = () => {
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [activeFeed, setActiveFeed] = useState('public');
    const [posts, setPosts] = useState([]);
    const [likeLoadingIds, setLikeLoadingIds] = useState(new Set());
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [loadingUserProfile, setLoadingUserProfile] = useState(true);
    const { userInfo, userLoading } = useUser();
    const [isPostViewerOpen, setIsPostViewerOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showSearchInput, setShowSearchInput] = useState(false);
    const [searchCaption, setSearchCaption] = useState('');
    const [feedError, setFeedError] = useState(null);
    const searchTimeoutRef = useRef(null);
    const navigate = useNavigate();
    // Removed familyCode hook since we're using userInfo directly

    const goToUserProfile = (targetUserId) => {
        if (!targetUserId) return;
        const myId = userInfo?.userId;
        if (myId && Number(targetUserId) === Number(myId)) {
            navigate('/myprofile');
        } else {
            navigate(`/user/${targetUserId}`);
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
            setToken(storedToken);
        }
        
        // Listen for storage changes (in case token is updated elsewhere)
        const handleStorageChange = (e) => {
            if (e.key === 'access_token') {
                setToken(e.newValue);
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        if (!userInfo) return;

        const userObj = {
            id: userInfo.userId,
            avatar:  userInfo.profileUrl || "/assets/user.png",
            profileImage: userInfo.profileUrl || "/assets/user.png",
            name: userInfo.name || "Username",
            fullName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
            basicInfo: userInfo.bio ? userInfo.bio.split('.')[0] : "Family member",
            bio: userInfo.bio || "No bio yet",
            contactNumber: userInfo.contactNumber || "",
            email: userInfo.email || "",
            familyCode: userInfo.familyCode || userInfo.raw?.familyMember?.familyCode || "Not assigned",
        };

        setUser(userObj);  
        setLoadingUserProfile(false);
    }, [userInfo]);

     // State for modal visibility
    

    // Define fetchPosts outside of useEffect so you can call it elsewhere
    const fetchPosts = async (captionSearch = '', retryCount = 0) => {
        // For family feed, check if user has familyCode and is approved
        if (activeFeed === 'family' && (!userInfo?.familyCode || userInfo?.approveStatus !== 'approved')) {
            setPosts([]);
            setLoadingFeed(false);
            return;
        }

        setLoadingFeed(true);
        try {
            // Get fresh token in case it was updated
            const currentToken = localStorage.getItem('access_token');
            const headers = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
            
            let url =
            activeFeed === 'family'
                ? `${import.meta.env.VITE_API_BASE_URL}/post/by-options?familyCode=${userInfo.familyCode}&privacy=private`
                : `${import.meta.env.VITE_API_BASE_URL}/post/by-options?privacy=public`;

            if (captionSearch.trim()) {
            url += `&caption=${encodeURIComponent(captionSearch.trim())}`;
            }

            const response = await fetch(url, { headers });
            
            // Check if response is successful
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Unauthorized: Token might be expired or invalid');
                    setFeedError('Authentication failed. Please refresh the page or log in again.');
                    
                    // If this is the first attempt and we have a token, try to refresh user info
                    if (retryCount === 0 && currentToken) {
                        console.log('Attempting to refresh user info...');
                        
                        // Wait a bit and retry once
                        setTimeout(() => {
                            fetchPosts(captionSearch, 1);
                        }, 1000);
                        return;
                    }
                    
                    // If still failing after retry, clear posts and stop
                    setPosts([]);
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Check if data is an array before mapping
            if (!Array.isArray(data)) {
                console.error('API returned non-array data:', data);
                setFeedError('Invalid data received from server. Please try again.');
                setPosts([]);
                return;
            }

            const formattedPosts = data.map(post => ({
            id: post.id,
            author: post.user?.name || 'Unknown',
            authorId: post.user?.userId || post.createdBy || null,
            avatar: post.user?.profile || '/assets/user.png',
            time: new Date(post.createdAt).toLocaleString(),
            caption: post.caption,
            fullImageUrl: post.postImage,
            url: post.postImage,
            postVideo: post.postVideo,
            likes: post.likeCount,
            comments: post.commentCount,
            liked: post.isLiked,
            isLiked: post.isLiked,
            privacy: post.privacy,
            }));

            setPosts(formattedPosts);
            setFeedError(null); // Clear any previous errors on success
        } catch (error) {
            console.error('Failed to fetch posts:', error);
            setFeedError('Failed to load posts. Please try again.');
            setPosts([]);
        } finally {
            setLoadingFeed(false);
        }
    };

    // Call fetchPosts inside useEffect for initial loading and on changes
    useEffect(() => {
        setFeedError(null); // Clear errors when feed changes
        fetchPosts();
    }, [activeFeed, userInfo?.familyCode, userInfo?.approveStatus]);

    console.log(posts);
    

    // Handle post creation callback
    const handlePostCreated = () => {
    // Close the modal if needed
    // setIsCreateModalOpen(false);

    // Reload the feed
    fetchPosts();
    };

    const filteredPosts = activeFeed === 'family'
        ? posts.filter(post => post.privacy === 'family')
        : posts.filter(post => post.privacy === 'public');


    const toggleLike = async (postId) => {
        if (likeLoadingIds.has(postId)) return; // prevent multiple clicks during loading

        // Add postId to loading set
        setLikeLoadingIds(prev => new Set(prev).add(postId));

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/post/${postId}/like-toggle`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
            });
            const data = await response.json();

            if (response.ok) {
            // Update post like status and like count in posts array
            setPosts(prevPosts =>
                prevPosts.map(post =>
                post.id === postId
                    ? { ...post, liked: data.liked, likes: data.totalLikes }
                    : post
                )
            );
            } else {
            console.error('Failed to toggle like:', data.message || response.statusText);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }

        // Remove postId from loading set
        setLikeLoadingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
        });
    };

    const handleViewPost = (post) => {
        setSelectedPost(post);
        setIsPostViewerOpen(true);
    };

    const handleClosePostViewer = () => {
        setIsPostViewerOpen(false);
        setSelectedPost(null);
    };
    

    return (
        <>
            {/* Flex container for main content and right sidebar */}
            <div className="flex flex-col lg:flex-row lg:gap-8 max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8">

                {/* Main Content (Feed) Column */}
                <div className="w-full">

                    {/* Top Bar - Clean and Functional */}
                    <div className="flex items-center justify-between gap-4 py-3 mb-6">
                        <h1 className="text-3xl font-extrabold text-gray-900 leading-none">Posts & Stories</h1>
                        <div className="flex items-center gap-3">
                            {/* Feed Switcher - Modern Segmented Control */}
                            <div className="relative inline-flex rounded-full p-1">
                                <button
                                    onClick={() => setActiveFeed('public')}
                                    className={`flex items-center gap-1.5 py-2 px-3 mr-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                                        activeFeed === 'public'
                                            ? 'bg-primary-600 text-white shadow-md'
                                            : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <MdPublic size={18} /> Public
                                </button>
                                {userInfo?.familyCode && userInfo?.approveStatus === 'approved' && (
                                  <button
                                    onClick={() => setActiveFeed('family')}
                                    className={`flex items-center gap-1.5 py-2 px-3 mr-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                                        activeFeed === 'family'
                                            ? 'bg-primary-600 text-white shadow-md'
                                            : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    <MdPeople size={18} /> Family
                                  </button>
                                )}
                                
                            </div>

                            {/* Search and Notification Buttons */}
                            {showSearchInput ? (
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search posts..."
                                value={searchCaption}
                                onChange={(e) => {
                                const value = e.target.value;
                                setSearchCaption(value);

                                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                                searchTimeoutRef.current = setTimeout(() => {
                                    fetchPosts(value); // pass search string
                                }, 500); // debounce
                                }}
                                onBlur={() => {
                                if (!searchCaption) setShowSearchInput(false);
                                }}
                                className="w-48 px-3 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                            ) : (
                            <button
                                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75"
                                onClick={() => setShowSearchInput(true)}
                            >
                                <FiSearch size={20} />
                            </button>
                            )}
                            {/* <button className="relative p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-opacity-75">
                                <FiBell size={20} />
                                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                            </button> */}
                        </div>
                    </div>

                    {/* "What's on your mind?" - Integrated Post Trigger */}
                    {user ? (
                        <div className="bg-white rounded-xl p-3 flex items-center gap-3 mb-6 border border-gray-100 shadow-sm">
                            <img
                                src={user.avatar}
                                alt="Your Avatar"
                                className="w-11 h-11 rounded-full object-cover border-2 border-primary-200 flex-shrink-0"
                            />
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex-1 text-left bg-gray-100 text-gray-500 rounded-full py-2.5 px-4 cursor-pointer hover:bg-gray-200 transition-colors text-base font-medium"
                            >
                                What's on your mind, {user.name.split('_')[0]}?
                            </button>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="text-white hover:text-primary-800 transition-colors p-2 rounded-full hover:bg-gray-100"
                                title="Add photo"
                            >
                                <FiImage size={24} />
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl p-3 flex items-center gap-3 mb-6 border border-gray-100 shadow-sm h-[80px] animate-pulse" />
                    )}

                    {/* Main Feed Content - Streamlined Posts */}
                    <div className="space-y-4">
                        {feedError && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-red-800">{feedError}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setFeedError(null);
                                            fetchPosts();
                                        }}
                                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                                    >
                                        Retry
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {loadingFeed ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-primary-600 border-solid"></div>
                            </div>
                        ) : posts.length > 0 ? (
                            posts.map(post => (
                                <div key={post.id} className="bg-white rounded-xl overflow-hidden animate-fade-in border border-gray-100">
                                    {/* Post Header */}
                                    <div className="flex items-center justify-between p-4 pb-2">
                                        <div className="flex items-center">
                                            <img
                                                src={post.avatar}
                                                alt={post.author}
                                                className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-primary-200 cursor-pointer"
                                                onClick={() => goToUserProfile(post.authorId)}
                                            />
                                            <div>
                                                <p
                                                    className="font-bold text-gray-900 text-base cursor-pointer"
                                                    onClick={() => goToUserProfile(post.authorId)}
                                                >
                                                    {post.author}
                                                </p>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                                                    <span>{post.time}</span>
                                                    {post.privacy === 'family' ? (
                                                        <span className="flex items-center gap-0.5 text-primary-600" title="Visible to Family Only">
                                                            <FiUsers size={14} /> Family
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-0.5 text-green-600" title="Public Post">
                                                            <FiGlobe size={14} /> Public
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                    </div>

                                    {/* Post Content */}
                                    <div className="px-4 py-2">
                                        <p className="text-gray-800 text-base leading-relaxed">{post.caption}</p>
                                    </div>

                                    {/* Post Media */}
                                    {post.postVideo ? (
                                      <div className="w-full h-80 bg-gray-100 flex items-center justify-center overflow-hidden mt-3 mb-2">
                                        <video
                                          src={post.postVideo}
                                          className="w-full h-full object-cover"
                                          controls
                                        />
                                      </div>
                                    ) : (
                                      post.fullImageUrl && (
                                        <div className="w-full h-80 bg-gray-100 flex items-center justify-center overflow-hidden mt-3 mb-2">
                                          <img src={post.fullImageUrl} alt="Post media" className="w-full h-full object-cover" />
                                        </div>
                                      )
                                    )}
                                    

                                    {/* Post Footer - Likes, Comments, Share */}
                                    <div className="px-4 pt-3 border-t border-gray-100">
                                        <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                                            <span className="flex items-center gap-1">
                                                <FaHeart className="text-red-500" /> {post.likes} Likes
                                            </span>
                                            <span className="cursor-pointer hover:underline"
                                            onClick={() => handleViewPost(post)}
                                            >
                                                {post.comments} Comments
                                            </span>
                                        </div>
                                        <div className="flex -mx-1">
                                            <button
                                                onClick={() => toggleLike(post.id)}
                                                disabled={likeLoadingIds.has(post.id)}
                                                className={`bg-unset flex-1 flex items-center justify-center gap-2 py-2 px-1 rounded-lg font-medium transition-colors text-base 
                                                    ${post.liked ? 'text-red-500' : 'text-gray-600'}
                                                    ${likeLoadingIds.has(post.id) ? 'cursor-wait' : 'cursor-pointer'}
                                                `}
                                                >
                                                {likeLoadingIds.has(post.id)
                                                    ? (
                                                    <svg className="animate-spin h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" >
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                    </svg>
                                                    )
                                                    : post.liked
                                                    ? <FaHeart size={20} />
                                                    : <FaRegHeart size={20} />
                                                }
                                                Like
                                            </button>
                                            <button 
                                            className="bg-unset flex-1 flex items-center justify-center gap-2 py-2 px-1 text-gray-600  rounded-lg font-medium transition text-base"
                                            onClick={() => handleViewPost(post)}
                                            >
                                                <FaCommentDots size={20} /> Comment
                                            </button>
                                            {/* <button className="bg-unset flex-1 flex items-center justify-center gap-2 py-2 px-1 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition text-base">
                                                <FaShareAlt size={20} /> Share
                                            </button> */}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm p-8 text-gray-600 border">
                                <p className="text-xl font-medium mb-4">
                                    No posts to display in the {activeFeed} feed yet!
                                </p>
                                <button onClick={() => setIsCreateModalOpen(true)} 
                                className="flex items-center gap-1.5 py-2 px-3 mr-2 rounded-full text-sm font-semibold transition-all duration-200 bg-primary-600 text-white shadow-md"
                                >
                                    <FiFeather size={20} /> Create First Post
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar Column (Desktop Only) - HIDDEN FOR FUTURE USE */}
                {/* 
                <div className="hidden lg:block lg:w-1/3 xl:w-1/4 mt-8 lg:mt-0 space-y-4">

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-lg text-gray-800 mb-5">Upcoming Events</h3>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <div className="bg-primary-100 p-2 rounded-full flex-shrink-0">
                                    <FiCalendar size={18} className="text-primary-600" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="font-semibold text-gray-800 text-base leading-tight">Grandma's 80th Birthday</p>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                        <span className="font-medium">June 25, 2025</span> • 6:00 PM
                                    </p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <FiMapPin size={12} className="text-gray-400" /> Community Hall
                                    </p>
                                </div>
                            </li>
                            <hr className="border-gray-200" />
                            <li className="flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <div className="bg-primary-100 p-2 rounded-full flex-shrink-0">
                                    <FiCalendar size={18} className="text-primary-600" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="font-semibold text-gray-800 text-base leading-tight">Family Picnic at Lake View Park</p>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                        <span className="font-medium">July 10, 2025</span> • 11:00 AM - 4:00 PM
                                    </p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <FiMapPin size={12} className="text-gray-400" /> Lake View Park, Section B
                                    </p>
                                </div>
                            </li>
                        </ul>
                        <button className="w-full mt-4 py-2 px-4 bg-primary-50 text-primary-700 font-semibold rounded-lg hover:bg-primary-100 transition-colors text-sm">
                            View All Events
                        </button>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-lg text-gray-800 mb-5">Gift Ideas for Family</h3>
                        <ul className="space-y-4">
                            <li className="bg-gray-50 rounded-lg p-3 flex items-center shadow-sm border border-gray-100 transition-shadow hover:shadow-md cursor-pointer">
                                <img src="https://picsum.photos/seed/gift1/100/100" alt="Personalized Photo Album" className="w-24 h-24 rounded-md object-cover flex-shrink-0 mr-4 border border-gray-200" />
                                <div className="flex-grow flex flex-col justify-center">
                                    <p className="font-semibold text-gray-800 text-sm mb-1 leading-tight line-clamp-2">Personalized Photo Album</p>
                                    <p className="text-base text-primary-700 font-bold mb-3">₹1,200</p>
                                    <button className="w-full bg-primary-500 text-white text-xs font-semibold py-2 rounded-md hover:bg-primary-600 transition-colors">
                                        Buy Now
                                    </button>
                                </div>
                            </li>
                            <hr className="border-gray-200" />
                            <li className="bg-gray-50 rounded-lg p-3 flex items-center shadow-sm border border-gray-100 transition-shadow hover:shadow-md cursor-pointer">
                                <img src="https://picsum.photos/seed/gift2/100/100" alt="Smartwatch" className="w-24 h-24 rounded-md object-cover flex-shrink-0 mr-4 border border-gray-200" />
                                <div className="flex-grow flex flex-col justify-center">
                                    <p className="font-semibold text-gray-800 text-sm mb-1 leading-tight line-clamp-2">Smartwatch</p>
                                    <p className="text-base text-primary-700 font-bold mb-3">₹8,500</p>
                                    <button className="w-full bg-primary-500 text-white text-xs font-semibold py-2 rounded-md hover:bg-primary-600 transition-colors">
                                        Buy Now
                                    </button>
                                </div>
                            </li>
                            <hr className="border-gray-200" />
                            <li className="bg-gray-50 rounded-lg p-3 flex items-center shadow-sm border border-gray-100 transition-shadow hover:shadow-md cursor-pointer">
                                <img src="https://picsum.photos/seed/gift3/100/100" alt="Handmade Ceramic Mug Set" className="w-24 h-24 rounded-md object-cover flex-shrink-0 mr-4 border border-gray-200" />
                                <div className="flex-grow flex flex-col justify-center">
                                    <p className="font-semibold text-gray-800 text-sm mb-1 leading-tight line-clamp-2">Handmade Ceramic Mug Set</p>
                                    <p className="text-base text-primary-700 font-bold mb-3">₹750</p>
                                    <button className="w-full bg-primary-500 text-white text-xs font-semibold py-2 rounded-md hover:bg-primary-600 transition-colors">
                                        Buy Now
                                    </button>
                                </div>
                            </li>
                        </ul>
                        <button className="w-full mt-4 py-2 px-4 bg-primary-50 text-primary-700 font-semibold rounded-lg hover:bg-primary-100 transition-colors text-sm">
                            View More Gift Ideas
                        </button>
                    </div>
                </div>
                */}
            </div>

            {/* Create Post Modal */}
            <CreatePostModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onPostCreated={handlePostCreated}
                currentUser={userInfo}
                authToken={token}
                mode="create"
            />

            <PostViewerModal
                isOpen={isPostViewerOpen}
                onClose={handleClosePostViewer}
                post={selectedPost}
                authToken={token}
                currentUser={user}
            />

            {/* Floating Action Button for Mobile - Optional */}
            <button
                onClick={() => setIsCreateModalOpen(true)}
                className="fixed bottom-20 right-6 bg-primary-600 text-white p-4 rounded-full shadow-lg lg:hidden z-40 hover:bg-primary-700 transition-colors transform hover:scale-110"
                title="Create New Post"
            >
                <FiPlusCircle size={28} />
            </button>
        </>
    );
};

export default PostsAndFeedsPage;