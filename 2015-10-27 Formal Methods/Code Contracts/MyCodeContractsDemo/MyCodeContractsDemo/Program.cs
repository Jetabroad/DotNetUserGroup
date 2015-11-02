using System;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MyCodeContractsDemo
{
    enum Status
    {
        Active,
        Deleted,
        Invalid,
        OnFire
    }
    public class Program
    {
        static void Main(string[] args)
        {
            HandleStatus(Status.OnFire);
            Console.WriteLine(GetAverageWordLength(new[] { "Hello", "world" }));
            Console.WriteLine(GetAverageWordLength(new[] { "Hello", "planet", "earth" }));
            Console.WriteLine(GetAverageWordLength(new string[0]));
            Console.WriteLine(GetAverageWordLength(null));
            Console.ReadKey();
        }

        private static bool HandleStatus(Status status)
        {
            switch(status)
            {
                case Status.Active:
                    return true;
                case Status.Deleted:
                    return false;
                case Status.Invalid:
                    return false;
                default:
                    Contract.Assert(false);
                    throw new Exception("unexpected enumeration value");
            }
        }

        public static double GetAverageWordLength(string[] words)
        {
            Contract.Requires(words != null);
            Contract.Requires(words.Length > 0);
            Contract.Ensures(Contract.Result<double>() >= 0);

            if(words.Length == 3)
            {
                return -1;
            }
            return words.Average(word => word.Length);
        }
    }
}
