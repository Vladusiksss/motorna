import {storage} from '@/db/storage';
export async function catalogDb(){return storage();}
export const shareHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
