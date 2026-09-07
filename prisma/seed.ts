import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
const permissions = ['booking.read','booking.create','booking.update','booking.cancel','booking.checkin','booking.checkout','customer.read','customer.create','customer.update','property.read','property.create','property.update','property.publish','unit.read','unit.create','unit.update','unit.publish','availability.read','availability.update','pricing.read','pricing.update','payment.read','payment.confirm','payment.refund','seo.read','seo.metadata.update','seo.publish','seo.redirect.manage','seo.sitemap.read','seo.audit.read','content.blog.manage','content.landing.manage','staff.manage','report.read'];
async function main():Promise<void>{
  await Promise.all(permissions.map(code=>prisma.permission.upsert({where:{code},create:{code},update:{}})));
  const all=await prisma.permission.findMany();
  const owner=await prisma.role.upsert({where:{code:'ADMIN_OWNER'},create:{code:'ADMIN_OWNER',name:'Admin owner'},update:{}});
  const staff=await prisma.role.upsert({where:{code:'STAFF'},create:{code:'STAFF',name:'Staff'},update:{}});
  await prisma.rolePermission.createMany({data:all.map(p=>({roleId:owner.id,permissionId:p.id})),skipDuplicates:true});
  const staffCodes=new Set(['booking.read','booking.create','booking.update','booking.cancel','booking.checkin','booking.checkout','customer.read','customer.create','customer.update','availability.read','pricing.read','payment.read','payment.confirm','unit.read','property.read']);
  await prisma.rolePermission.createMany({data:all.filter(p=>staffCodes.has(p.code)).map(p=>({roleId:staff.id,permissionId:p.id})),skipDuplicates:true});
  let city=await prisma.location.findFirst({where:{parentId:null,slugVi:'da-nang'}});
  city??=await prisma.location.create({data:{type:'CITY',nameVi:'Đà Nẵng',nameEn:'Da Nang',slugVi:'da-nang',slugEn:'da-nang',latitude:16.0544,longitude:108.2022,status:'PUBLISHED'}});
  const property=await prisma.property.upsert({where:{slugVi:'panoma'},create:{name:'TT Apartment',slugVi:'panoma',slugEn:'panoma',descriptionVi:'Căn hộ dịch vụ hiện đại tại Đà Nẵng.',descriptionEn:'Modern serviced apartments in Da Nang.',locationId:city.id,address:'Mỹ An, Ngũ Hành Sơn, Đà Nẵng',latitude:16.0471,longitude:108.2445,checkInTime:'14:00',checkOutTime:'11:00',status:'ACTIVE',publishedAt:new Date()},update:{name:'TT Apartment',descriptionVi:'Căn hộ dịch vụ hiện đại tại Đà Nẵng.',descriptionEn:'Modern serviced apartments in Da Nang.',status:'ACTIVE'}});
  await prisma.unit.upsert({where:{publicCode:'PANO-2BR-01'},create:{propertyId:property.id,internalCode:'INT-PANO-2BR-01',publicCode:'PANO-2BR-01',nameVi:'Panoma 2PN View Biển',nameEn:'Panoma 2BR Ocean View',slugVi:'panoma-2pn-view-bien-01',slugEn:'panoma-2br-ocean-view-01',descriptionVi:'Không gian hai phòng ngủ ngập ánh sáng, ban công hướng biển và đầy đủ tiện nghi cho một kỳ nghỉ thư thái.',descriptionEn:'A light-filled two-bedroom apartment with an ocean-facing balcony and everything needed for an effortless stay.',bedroomCount:2,bathroomCount:2,bedCount:2,maxGuests:4,area:82,viewType:'OCEAN',basePrice:1450000,currency:'VND',cleaningFee:200000,serviceFeeRate:0.05,depositRate:0.3,status:'PUBLISHED',publishedAt:new Date()},update:{status:'PUBLISHED',basePrice:1450000,cleaningFee:200000,serviceFeeRate:0.05,depositRate:0.3}});
  const demoUnits=[
    ['TT-STUDIO-02','TT Studio Ban Công','TT Studio with Balcony',1,1,1,2,38,'CITY',720000],
    ['TT-STUDIO-03','TT Studio Tiêu Chuẩn','TT Standard Studio',1,1,1,2,34,'CITY',650000],
    ['TT-1BR-04','TT Căn Hộ 1PN','TT One Bedroom Apartment',1,1,1,3,52,'CITY',890000],
    ['TT-1BR-05','TT 1PN Ban Công','TT One Bedroom Balcony',1,1,1,3,58,'CITY',990000],
    ['TT-1BR-06','TT 1PN View Biển','TT One Bedroom Ocean View',1,1,1,3,60,'OCEAN',1150000],
    ['TT-2BR-07','TT Căn Hộ 2PN','TT Two Bedroom Apartment',2,2,2,4,78,'CITY',1350000],
    ['TT-2BR-08','TT 2PN Gia Đình','TT Family Two Bedroom',2,2,3,5,86,'CITY',1580000],
    ['TT-2BR-09','TT 2PN View Biển','TT Two Bedroom Ocean View',2,2,2,4,88,'OCEAN',1720000],
    ['TT-3BR-10','TT Căn Hộ 3PN','TT Three Bedroom Apartment',3,2,3,6,112,'OCEAN',2250000],
  ] as const;
  const seededUnits=[];
  for(const [publicCode,nameVi,nameEn,bedrooms,bathrooms,beds,maxGuests,area,viewType,basePrice] of demoUnits){
    const slug=publicCode.toLowerCase();
    seededUnits.push(await prisma.unit.upsert({where:{publicCode},create:{propertyId:property.id,internalCode:`INT-${publicCode}`,publicCode,nameVi,nameEn,slugVi:slug,slugEn:slug,descriptionVi:`${nameVi} tại TT Apartment, đầy đủ tiện nghi cho tối đa ${maxGuests} khách.`,descriptionEn:`${nameEn} at TT Apartment with essentials for up to ${maxGuests} guests.`,bedroomCount:bedrooms,bathroomCount:bathrooms,bedCount:beds,maxGuests,area,viewType,basePrice,currency:'VND',cleaningFee:150000,serviceFeeRate:0.05,depositRate:0.3,status:'PUBLISHED',publishedAt:new Date()},update:{nameVi,nameEn,bedroomCount:bedrooms,bathroomCount:bathrooms,bedCount:beds,maxGuests,area,viewType,basePrice,status:'PUBLISHED'}}));
  }
  const allUnits=await prisma.unit.findMany({where:{propertyId:property.id},orderBy:{publicCode:'asc'}});
  const panoramaImages=[
    {storageKey:'seed/panorama-01.jpg',url:'https://cdn.tgdd.vn/hoi-dap/906425/chup-anh-panorama-toan-canh-tren-camera-cua-smar%201-800x400.jpg',width:800,height:400},
    {storageKey:'seed/panorama-02.jpg',url:'https://cdn.tgdd.vn/hoi-dap/906425/chup-anh-panorama-toan-canh-tren-camera-cua-smar%202-800x450.jpg',width:800,height:450},
    {storageKey:'seed/panorama-03.jpg',url:'https://cdn.tgdd.vn/hoi-dap/906425/chup-anh-panorama-toan-canh-tren-camera-cua-smar%203-800x450.jpg',width:800,height:450},
  ];
  const mediaItems:{id:string}[]=[];
  for(const [index,image] of panoramaImages.entries())mediaItems.push(await prisma.media.upsert({where:{storageKey:image.storageKey},create:{...image,mimeType:'image/jpeg',fileSize:0,altVi:`Ảnh panorama căn hộ TT Apartment ${index+1}`,altEn:`TT Apartment panorama ${index+1}`},update:{url:image.url,width:image.width,height:image.height,mimeType:'image/jpeg',altVi:`Ảnh panorama căn hộ TT Apartment ${index+1}`,altEn:`TT Apartment panorama ${index+1}`}}));
  await prisma.unitMedia.deleteMany({where:{unitId:{in:allUnits.map(unit=>unit.id)}}});
  await prisma.unitMedia.createMany({data:allUnits.flatMap((unit,unitIndex)=>mediaItems.map((_,imageIndex)=>{const media=mediaItems[(unitIndex+imageIndex)%mediaItems.length];return{unitId:unit.id,mediaId:media.id,sortOrder:imageIndex,type:'IMAGE' as const}}))});
  await prisma.availabilityBlock.deleteMany({where:{reason:{startsWith:'SEED-SEP-2026'}}});
  const septemberBlocks:Array<[string|undefined,string,string,string]>=[
    [allUnits[0]?.id,'2026-09-03','2026-09-07','SEED-SEP-2026 booking giả lập 01'],
    [allUnits[1]?.id,'2026-09-10','2026-09-15','SEED-SEP-2026 bảo trì 02'],
    [allUnits[2]?.id,'2026-09-18','2026-09-23','SEED-SEP-2026 booking giả lập 03'],
    [allUnits[3]?.id,'2026-09-01','2026-10-01','SEED-SEP-2026 khóa cả tháng 04'],
    [allUnits[4]?.id,'2026-09-25','2026-09-29','SEED-SEP-2026 bảo trì 05'],
  ];
  await prisma.availabilityBlock.createMany({data:septemberBlocks.filter((x):x is [string,string,string,string]=>Boolean(x[0])).map(([unitId,start,end,reason],index)=>({unitId,startDate:new Date(`${start}T00:00:00.000Z`),endDate:new Date(`${end}T00:00:00.000Z`),state:index%2?'MAINTENANCE':'BLOCKED',reason}))});
  for(const unit of allUnits){for(const [day,multiplier] of [[4,1.15],[5,1.2],[11,1.15],[12,1.2],[18,1.15],[19,1.2]] as const){await prisma.dailyRate.upsert({where:{unitId_date:{unitId:unit.id,date:new Date(`2026-09-${String(day).padStart(2,'0')}T00:00:00.000Z`)}},create:{unitId:unit.id,date:new Date(`2026-09-${String(day).padStart(2,'0')}T00:00:00.000Z`),amount:Number(unit.basePrice)*multiplier,minStay:2},update:{amount:Number(unit.basePrice)*multiplier,minStay:2}})}}
  const email=process.env.ADMIN_EMAIL?.toLowerCase(),password=process.env.ADMIN_PASSWORD;
  if(email&&password){if(password.length<8)throw new Error('ADMIN_PASSWORD must have at least 8 characters');const passwordHash=await argon2.hash(password);const user=await prisma.user.upsert({where:{email},create:{email,passwordHash,firstName:'Admin',lastName:'Owner'},update:{passwordHash}});await prisma.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:owner.id}},create:{userId:user.id,roleId:owner.id},update:{}});}
}
main().finally(()=>prisma.$disconnect());
