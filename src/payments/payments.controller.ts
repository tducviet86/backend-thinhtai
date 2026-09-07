import { Body, Controller, Param, Post, Req, Version } from '@nestjs/common';
import { PaymentType, Prisma } from '@prisma/client';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { Request } from 'express';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
class PaymentDto { @IsEnum(PaymentType) type!:PaymentType; @IsString() method!:string; @IsNumber({maxDecimalPlaces:2}) @Min(0.01) amount!:number }
@Controller('admin/bookings/:bookingId/payments')
export class PaymentsController {
  constructor(private readonly p:PrismaService){}
  @RequirePermissions('payment.confirm') @Post() @Version('1')
  create(@Param('bookingId') bookingId:string,@Body() d:PaymentDto,@Req() req:Request){
    return this.p.$transaction(async tx=>{
      const b=await tx.booking.findUniqueOrThrow({where:{id:bookingId}});
      const payment=await tx.payment.create({data:{bookingId,type:d.type,method:d.method,amount:d.amount,currency:b.currency,status:'PAID',paidAt:new Date()}});
      const aggregate=await tx.payment.aggregate({where:{bookingId,status:'PAID'},_sum:{amount:true}});
      const paid=aggregate._sum.amount??new Prisma.Decimal(0);
      await tx.booking.update({where:{id:bookingId},data:{paidAmount:paid,remainingAmount:b.total.sub(paid),status:paid.gte(b.depositRequired)&&b.status==='PENDING_PAYMENT'?'CONFIRMED':b.status}});
      await tx.auditLog.create({data:{actorUserId:req.user!.sub,action:'payment.confirm',entityType:'Payment',entityId:payment.id,after:{amount:d.amount,method:d.method}}});
      return payment;
    });
  }
}
