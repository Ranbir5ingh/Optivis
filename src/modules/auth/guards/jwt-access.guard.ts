import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAccessGuard extends AuthGuard("jwt-access"){
    handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
        if(err||!user){
            throw new UnauthorizedException("Access token missing or invalid")
        }
        return user 
    }
}