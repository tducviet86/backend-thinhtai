import { BookingStateService } from './booking-state.service';
describe('BookingStateService',()=>{const service=new BookingStateService();it('allows confirmed to check in',()=>expect(()=>service.assert('CONFIRMED','CHECKED_IN')).not.toThrow());it('rejects arbitrary terminal transitions',()=>expect(()=>service.assert('COMPLETED','CONFIRMED')).toThrow());});
