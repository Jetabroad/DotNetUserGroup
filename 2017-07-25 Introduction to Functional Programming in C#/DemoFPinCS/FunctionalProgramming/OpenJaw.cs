using System;
using System.Collections.Generic;
using System.Text;
using System.Linq;

namespace FunctionalProgramming
{
    public static class OpenJaw
    {

        public static (IEnumerable<IEnumerable<FlightSegment>> OJ, IEnumerable<FlightSegment> Other) AllOpenJaws(this FlightQuery flightQuery)
        {
            var allOpenJaws = AllOpenJawsInternal(flightQuery);
            
            var allOpenJawsFlatten = allOpenJaws.SelectMany(x => x);
            IEnumerable<FlightSegment> allSegments = flightQuery.FlightSegments;
            return (allOpenJaws, allSegments.Except(allOpenJawsFlatten));
        }
        private static IEnumerable<IEnumerable<FlightSegment>> AllOpenJawsInternal(this FlightQuery flightQuery)
        {
            var head = flightQuery.FlightSegments.First();
            var tail = flightQuery.FlightSegments.Skip(1).ToList();

            if (tail.Count() >= 1)
            {
                // Modify this part to change the logic for the OpenJaw
                var openJaw = tail.Where(elem => elem.Destination == head.Origin && elem.Departure > head.Departure).ToList();
                if (openJaw.Any())
                {
                    var theRest = tail.Except(openJaw).ToList();
                    return new[] { openJaw.Prepend(head) }.Concat(
                        theRest.Any()
                            ? new FlightQuery { FlightSegments = theRest.ToArray() }.AllOpenJawsInternal()
                            : new List<IEnumerable<FlightSegment>>().ToArray());
                }
                else
                {
                    return new FlightQuery { FlightSegments = tail.ToArray() }.AllOpenJawsInternal();
                }
            }

            return new List<IEnumerable<FlightSegment>>().ToArray();
        }

        public static void OpenJawDemo(params string[] itinerary)
        {
            var flightQueryList = CreateFlightQuery(itinerary);
            var allOpenJaws = flightQueryList.AllOpenJaws();
            "+".HR(60);
            flightQueryList.FlightSegments.Select(x => x).Print("Full Itinerary");
            allOpenJaws.OJ.ToList().ForEach(x => x.Print("OpenJaws"));
            allOpenJaws.Other.Print("Other");
            "-".HR(60);
        }

        public static void HR(this string theString, int length)
        {
            Console.WriteLine("{0}", Enumerable.Repeat(theString, length).JoinToStringWith("").Substring(0, length));

        }

        public static FlightQuery CreateFlightQuery(params string[] itinerary)
        {
            return new FlightQuery
            {
                FlightSegments = itinerary.SelectMany((leg, j) =>
                {
                    var cities = leg.Split('-');
                    return cities
                        .Take(cities.Length - 1) // Skip the last one
                        .Select((city, i) =>
                            new FlightSegment
                            (
                                city,
                                cities[i + 1],
                                (j + 1) * (i + 1) + (j + 1)
                            )
                        );
                }).ToArray()
            };
        }

    }

    public class FlightQuery
    {
        public FlightSegment[] FlightSegments
        {
            get; set;
        }
    }

    public class FlightSegment
    {
        public FlightSegment(string origin, string destination, int departure)
        {
            Origin = origin;
            Destination = destination;
            Departure = departure;
        }

        public string Origin { get; private set; }
        public string Destination { get; private set; }
        public int Departure { get; private set; }

        public override string ToString()
        {
            return string.Format($"({Origin},{Destination})");
        }
    }


}
