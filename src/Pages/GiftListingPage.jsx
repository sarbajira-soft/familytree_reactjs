// GiftListingPage.js
import React from 'react';
import RetailMain from '../Retail/index';
import { useLocation } from 'react-router-dom';

const GiftListingPage = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const highlightedProductId = searchParams.get('productId');
    const initialTab = searchParams.get('tab') || 'products';

    return (
        <>
            <RetailMain initialProductId={highlightedProductId} initialTab={initialTab} />
        </>
    );
};

export default GiftListingPage;