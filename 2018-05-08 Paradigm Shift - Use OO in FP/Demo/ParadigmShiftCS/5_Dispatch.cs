using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ParadigmShiftCS.Dispatch
{
    using static DeviceStore;

    public static class Demo
    {
        public static void Run()
        {
            var macBook = new MacBook();
            var kindle = new Kindle();

            var macBookBasePrice = GetBasePrice(macBook);
            var kindleBasePrice = GetBasePrice(kindle);

            var macBookUplift = GetUplift(macBook);
            var kindleUplift = GetUplift(kindle);
        }
    }
    public class MacBook { }
    public class Kindle { }

    public static class DeviceStore
    {
        public static decimal GetBasePrice(MacBook macBook) => 
            // implementation
            10;
        public static decimal GetBasePrice(Kindle macBook) =>
            // implementation
            20;

        public static decimal GetUplift(MacBook macBook) =>
            // implementation
            2;
        public static decimal GetUplift(Kindle macBook) => 
            // implementation
            3;
    }
}
