import EventCard from "@/components/EventCard";
import ExploreBtn from "@/components/ExploreBtn";
import Event, { IEvent } from "@/database/event.model";
import connectDB from "@/lib/mongodb";
import { cacheLife, cacheTag } from "next/cache";

const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL 
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const BASE_URL = rawBaseUrl.startsWith("http://") || rawBaseUrl.startsWith("https://") 
  ? rawBaseUrl 
  : `https://${rawBaseUrl}`;

const page = async () => {
  'use cache';
  cacheLife('hours')
  cacheTag('events')

  let events: IEvent[] = [];
  try {
    const response = await fetch(`${BASE_URL}/api/events`);
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      const data = await response.json();
      events = data.events || [];
    } else {
      await connectDB();
      const dbEvents = await Event.find().sort({ createdAt: -1 }).lean();
      events = JSON.parse(JSON.stringify(dbEvents));
    }
  } catch {
    try {
      await connectDB();
      const dbEvents = await Event.find().sort({ createdAt: -1 }).lean();
      events = JSON.parse(JSON.stringify(dbEvents));
    } catch (dbError) {
      console.error("Failed to fetch events from database:", dbError);
    }
  }

  return (
    <section>
      <h1 className="text-center">The Hub for Every Dev <br /> Event You Can&apos;t Miss </h1>
      <p className="text-center mt-5">Hackathons, Meetups, and Conferences, All in One Place</p>

      <ExploreBtn />

      <div className="mt-20 space-y-7">
        <h3>Featured Events</h3>

        <ul className="events">
          {events && events.length > 0 && events.map((event: IEvent) => (
            <li key={event.title} className="list-none">
              <EventCard {...event} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default page
