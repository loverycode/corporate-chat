import { Controller, Put, Delete, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReactionsService } from "./reactions.service";

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class ReactionsController {
    constructor(private readonly reactionsService: ReactionsService) {}

    @Put(':id/reactions/:emoji')
    addReaction(@Param('id') id: string, @Param('emoji') emoji: string, @Req() req) {
        return this.reactionsService.addReaction(id, req.user.id, decodeURIComponent(emoji));
    }

    @Delete(':id/reactions/:emoji')
    removeReaction(@Param('id') id: string, @Param('emoji') emoji: string, @Req() req) {
        return this.reactionsService.removeReaction(id, req.user.id, decodeURIComponent(emoji));
    }
}