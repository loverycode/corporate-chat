import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { Headers } from '@nestjs/common';
import { TEST_OBJECTS, OBJECT_ACCESS } from './test-data';

interface ResolveRequest {
    objectIds: string[];
    forUserId: string;
}

@Controller('api/integration/chat')
export class ObjectsController {
    @Post('objects/resolve')
    resolve(
        @Body() body: ResolveRequest,
        @Headers('x-service-token') serviceToken: string,
    ) {
        if (serviceToken !== process.env.PORTAL_SERVICE_TOKEN) {
            throw new UnauthorizedException('invalid service token');
        }

        return body.objectIds.map((id) => {
            const object = TEST_OBJECTS[id];
            if (!object) {
                return { id, exists: false, canRead: false };
            }
            const allowedUsers = OBJECT_ACCESS[id] || [];
            const canRead = allowedUsers.includes(body.forUserId);
            if (!canRead) {
                return { id, exists: true, canRead: false };
            }
            return {
                id,
                exists: true,
                canRead: true,
                title: object.title,
                typeName: object.typeName,
                icon: object.icon,
                url: `/dashboard/object/${id}`,
            };
        });
    }
}