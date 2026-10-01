import connectDB from "@/lib/mongodb";
import {v2 as cloudinary} from 'cloudinary';
import { NextRequest, NextResponse } from "next/server";
import Event from '@/database/event.model';

export async function POST(req: NextRequest) {
    try {
        await connectDB()

        const formData = await req.formData()

        let event

        try {
            event = Object.fromEntries(formData.entries())
        } catch(e) {
            return NextResponse.json({message: 'Invalid JSON data format'}, {status: 400})
        }

        if (event.mode && typeof event.mode === 'string') {
            event.mode = event.mode.trim().toLowerCase();
        }

        if (event.agenda && typeof event.agenda === 'string') {
            try {
                event.agenda = JSON.parse(event.agenda);
            } catch {}
        }

        if (event.tags && typeof event.tags === 'string') {
            try {
                event.tags = JSON.parse(event.tags);
            } catch {}
        }

        const file = formData.get('image');

        if(!file) return NextResponse.json({message: 'Image file is required'}, {status: 400});

        let tags = JSON.parse(formData.get('tags') as string)
        let agenda = JSON.parse(formData.get('agenda') as string)

        if (typeof file === 'string') {
            event.image = file;
        } else if (file instanceof Blob || (typeof file === 'object' && typeof (file as any).arrayBuffer === 'function')) {
            const arrayBuffer = await (file as Blob).arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({resource_type: 'image', folder: 'DevEvent'}, (error, results) => {
                    if(error) return reject(error);

                    resolve(results);
                }).end(buffer);
            });

            event.image = (uploadResult as {secure_url: string}).secure_url;
        } else {
            return NextResponse.json({message: 'Invalid image format'}, {status: 400});
        }

        const createdEvent = await Event.create({
            ...event,
            tags: tags,
            agenda: agenda
        })

        return NextResponse.json({message: 'Event created successfully', event: createdEvent}, {status: 201})
    } catch(e) {
        console.log(e)
        return NextResponse.json({message: 'Event Creation Failed', error: e instanceof Error ? e.message : 'Unknown'}, {status: 500})
    }
}

export async function GET() {
    try {
        await connectDB()

        const events = await Event.find().sort({createdAt: -1})

        return NextResponse.json({message: 'Events fetched successfully', events}, {status: 200})
    } catch(e) {
        return NextResponse.json({message: 'Event fetching failed', error: e}, {status: 500})
    }
}
