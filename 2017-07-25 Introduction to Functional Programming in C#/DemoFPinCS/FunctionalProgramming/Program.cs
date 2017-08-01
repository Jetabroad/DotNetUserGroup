using System;
using System.Collections.Generic;
using System.Linq;

namespace FunctionalProgramming
{
    public static class Program
    {

        static void Main(string[] args)
        {
            HigherOrderFunctions.DemoHigherOrderFunctions();
            Imperative.DemoImperative();

            Honesty.HonestyDemo();

            OpenJaw.OpenJawDemo("MEL-BKK-KUL", "SIN-LON-NRT-MEL");
            OpenJaw.OpenJawDemo("MEL-BKK-PAR", "SIN-LON-BKK-NRT-MEL");
            OpenJaw.OpenJawDemo("MEL-BKK-SYD");
            OpenJaw.OpenJawDemo("MEL-SIN-BKK-SYD");

            TestAndAdjustData();
            Immutability.AddAndStore(5);
            Immutability.AddAndStore(5);
            Immutability.AddAndStore(5);

            /// What should this print?
            Console.WriteLine("Print Current = {0}", Immutability.accumulated);

        }

        private static void TestAndAdjustData()
        {
            // Doing some test
            // -----------------

            // Adjust data
            Immutability.accumulated = 11;
        }
    }
}