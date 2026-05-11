const DEFAULT_GALLERY_COVER = "https://via.placeholder.com/400x300?text=Photo";

const normalizePrivacy = (privacy) =>
  privacy === "private" || privacy === "family" ? "family" : "public";

const normalizeImage = (image, index = 0) => {
  if (!image) return null;

  const url = image.url || image.album || null;
  if (!url) return null;

  return {
    id: image.id ?? `${index}`,
    url,
    caption: image.caption || `Photo ${index + 1}`,
    sortOrder:
      Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : index,
  };
};

const getRawImages = (gallery) => {
  if (Array.isArray(gallery?.images)) {
    return gallery.images;
  }

  if (Array.isArray(gallery?.galleryAlbums)) {
    return gallery.galleryAlbums;
  }

  if (Array.isArray(gallery?.photos)) {
    return gallery.photos;
  }

  return [];
};

export const getGalleryListFromApiResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.galleries)) return payload.galleries;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const mapGallerySummary = (gallery) => {
  const images = getRawImages(gallery)
    .map(normalizeImage)
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const imageCount = Number.isFinite(Number(gallery?.imageCount))
    ? Number(gallery.imageCount)
    : images.length;
  const likeCount = Number.isFinite(Number(gallery?.likeCount))
    ? Number(gallery.likeCount)
    : Number(gallery?.likes || 0);
  const commentCount = Number.isFinite(Number(gallery?.commentCount))
    ? Number(gallery.commentCount)
    : Number(gallery?.comments?.length || 0);
  const coverImage =
    gallery?.coverImage ||
    gallery?.coverPhoto ||
    gallery?.cover ||
    images[0]?.url ||
    DEFAULT_GALLERY_COVER;

  return {
    id: gallery?.id,
    publicShareId: gallery?.publicShareId || null,
    shareUrl: gallery?.shareUrl || null,
    title: gallery?.galleryTitle || gallery?.title || "Album",
    galleryTitle: gallery?.galleryTitle || gallery?.title || "Album",
    description: gallery?.galleryDescription || gallery?.description || "",
    galleryDescription: gallery?.galleryDescription || gallery?.description || "",
    author: gallery?.user?.name || gallery?.author || "Unknown",
    authorId: gallery?.user?.userId || gallery?.authorId || gallery?.createdBy || null,
    privacy: normalizePrivacy(gallery?.privacy),
    familyCode: gallery?.familyCode || null,
    coverImage,
    coverPhoto: coverImage,
    cover: coverImage,
    imageCount,
    photosCount: imageCount,
    likes: likeCount,
    likeCount,
    commentCount,
    comments: new Array(commentCount).fill(""),
    isLiked: Boolean(gallery?.isLiked),
    isSeen: Boolean(gallery?.isSeen || gallery?.seen),
    seen: Boolean(gallery?.isSeen || gallery?.seen),
    finalScore: Number(gallery?.finalScore || 0),
    createdBy: gallery?.createdBy || gallery?.user?.userId || null,
    createdAt: gallery?.createdAt || null,
    user: gallery?.user || null,
    images,
    photos: images,
  };
};

export const mapGalleryDetail = (gallery) => mapGallerySummary(gallery);
