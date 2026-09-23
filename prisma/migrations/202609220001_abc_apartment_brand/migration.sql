-- Rebrand display content only; existing booking codes, URLs and account identifiers remain stable.

UPDATE "Property" SET
  "name" = replace(replace("name", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "descriptionVi" = replace(replace("descriptionVi", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "descriptionEn" = replace(replace("descriptionEn", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT')
WHERE "name" LIKE '%TT Apartment%' OR "name" LIKE '%TT APARTMENT%' OR "descriptionVi" LIKE '%TT Apartment%' OR "descriptionVi" LIKE '%TT APARTMENT%' OR "descriptionEn" LIKE '%TT Apartment%' OR "descriptionEn" LIKE '%TT APARTMENT%';

UPDATE "Unit" SET
  "nameVi" = replace(replace("nameVi", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "nameEn" = replace(replace("nameEn", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "descriptionVi" = replace(replace("descriptionVi", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "descriptionEn" = replace(replace("descriptionEn", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT')
WHERE "nameVi" LIKE '%TT Apartment%' OR "nameVi" LIKE '%TT APARTMENT%' OR "nameEn" LIKE '%TT Apartment%' OR "nameEn" LIKE '%TT APARTMENT%' OR "descriptionVi" LIKE '%TT Apartment%' OR "descriptionVi" LIKE '%TT APARTMENT%' OR "descriptionEn" LIKE '%TT Apartment%' OR "descriptionEn" LIKE '%TT APARTMENT%';

UPDATE "Media" SET
  "altVi" = replace(replace("altVi", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "altEn" = replace(replace("altEn", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "captionVi" = replace(replace("captionVi", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "captionEn" = replace(replace("captionEn", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT')
WHERE "altVi" LIKE '%TT Apartment%' OR "altVi" LIKE '%TT APARTMENT%' OR "altEn" LIKE '%TT Apartment%' OR "altEn" LIKE '%TT APARTMENT%' OR "captionVi" LIKE '%TT Apartment%' OR "captionVi" LIKE '%TT APARTMENT%' OR "captionEn" LIKE '%TT Apartment%' OR "captionEn" LIKE '%TT APARTMENT%';

UPDATE "SeoPage" SET
  "title" = replace(replace("title", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "metaDescription" = replace(replace("metaDescription", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "h1" = replace(replace("h1", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "ogTitle" = replace(replace("ogTitle", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "ogDescription" = replace(replace("ogDescription", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "twitterTitle" = replace(replace("twitterTitle", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT'),
  "twitterDescription" = replace(replace("twitterDescription", 'TT Apartment', 'ABC Apartment'), 'TT APARTMENT', 'ABC APARTMENT')
WHERE "title" LIKE '%TT Apartment%' OR "title" LIKE '%TT APARTMENT%' OR "metaDescription" LIKE '%TT Apartment%' OR "metaDescription" LIKE '%TT APARTMENT%' OR "h1" LIKE '%TT Apartment%' OR "h1" LIKE '%TT APARTMENT%' OR "ogTitle" LIKE '%TT Apartment%' OR "ogTitle" LIKE '%TT APARTMENT%' OR "ogDescription" LIKE '%TT Apartment%' OR "ogDescription" LIKE '%TT APARTMENT%' OR "twitterTitle" LIKE '%TT Apartment%' OR "twitterTitle" LIKE '%TT APARTMENT%' OR "twitterDescription" LIKE '%TT Apartment%' OR "twitterDescription" LIKE '%TT APARTMENT%';
