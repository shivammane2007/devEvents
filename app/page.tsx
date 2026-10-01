import EventCard from "@/components/EventCard";
import ExploreBtn from "@/components/ExploreBtn";
import { IEvent } from "@/database";
import { cacheLife, cacheTag } from "next/cache";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL 
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const page = async () => {
  'use cache';
  cacheLife('hours')
  cacheTag('events')

  let events: IEvent[] = [];
  try {
    const response = await fetch(`${BASE_URL}/api/events`);
    if (response.ok) {
      const data = await response.json();
      events = data.events || [];
    }
  } catch (error) {
    console.error("Failed to fetch events:", error);
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
