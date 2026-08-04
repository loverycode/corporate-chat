import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { TEST_OBJECTS } from './test-data';

@Controller('objects')
export class ObjectsController {
    @Post('resolve')
    resolve(@Body() body: { objectId: string }) {
        const object = TEST_OBJECTS[body.objectId];
        if (!object) {
            throw new NotFoundException('object not found');
        }
        return object;
    }
}