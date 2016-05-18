using System;
using Raspberry.IO.GeneralPurpose;

namespace DNXConsoleApplication1
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var usage = "You may enter one of: led, drive, drivecommands [commands]";
            var command = "";
            if (args.Length == 0)
            {
                Console.WriteLine(usage);
                args = Console.ReadLine().Split(' ');
                command = args[0];
            } else
            {
                command = args[0];
            }
            switch (command.Trim())
            {
                case "led": TestLEDs();
                    break;
                case "drive": TestDrive();
                    break;
                case "drivecommands":
                    TestDriveCommands(args);
                    break;
                default: Console.WriteLine(usage);
                    break;

            }
        }

        static PinConfiguration driveForward = ConnectorPin.P1Pin12.Output();
        static PinConfiguration driveBackward = ConnectorPin.P1Pin16.Output();
        static PinConfiguration driveTurnLeft = ConnectorPin.P1Pin18.Output();
        static PinConfiguration driveTurnRight = ConnectorPin.P1Pin22.Output();

        private static void TestLEDs()
        {
            Console.WriteLine("Test GPIO");
            var led1 = ConnectorPin.P1Pin31.Output();
            var led2 = ConnectorPin.P1Pin33.Output();
            var led3 = ConnectorPin.P1Pin35.Output();
            var led4 = ConnectorPin.P1Pin37.Output();
            var connection = new GpioConnection(led1, led2, led3, led4);


            for (int i = 0; i < 5; i++)
            {
                connection.Blink(led1, new TimeSpan(0, 0, 1));
                connection.Blink(led2, new TimeSpan(0, 0, 1));
                connection.Blink(led3, new TimeSpan(0, 0, 1));
                connection.Blink(led4, new TimeSpan(0, 0, 1));
            }
            connection.Close();
        }

        private static void TestDrive()
        {
            Console.WriteLine("Testing arrows with car driving");
            ConsoleKeyInfo cki;

            var connection = new GpioConnection(driveForward, driveBackward, driveTurnLeft, driveTurnRight);

            Console.WriteLine("Press the Escape (Esc) key to quit: \n");
            do
            {
                cki = Console.ReadKey();
                Console.Write(" ---   You pressed ");
                Console.WriteLine(cki.Key.ToString());
                switch (cki.Key)
                {
                    case ConsoleKey.UpArrow:
                        //connection.Blink(driveForward, new TimeSpan(0, 0, 0, 0, 300)); //Hack as we don't have immediate mode in managed code //Blink appears to have issues as it uses Timer
                        connection.Toggle(driveForward);
                        System.Threading.Thread.Sleep(300);
                        connection.Toggle(driveForward);
                        break;
                    case ConsoleKey.DownArrow:
                        connection.Toggle(driveBackward);
                        System.Threading.Thread.Sleep(300);
                        connection.Toggle(driveBackward);
                        break;
                    case ConsoleKey.LeftArrow:
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnLeft);
                        System.Threading.Thread.Sleep(400);
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnLeft);
                        break;
                    case ConsoleKey.RightArrow:
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnRight);
                        System.Threading.Thread.Sleep(400);
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnRight);
                        break;
                    default:
                        break;

                }
            } while (cki.Key != ConsoleKey.Escape);
            connection.Close();
        }

        private static void TestDriveCommands(string[] args)
        {
            Console.WriteLine("Testing drive commands");
            if (args.Length <= 1)
            {
                Console.WriteLine("No commands provided");
            }
            var connection = new GpioConnection(driveForward, driveBackward, driveTurnLeft, driveTurnRight);
            var command = "";
            for (int i = 1; i < args.Length-1; i++)
            {
                command = args[i];
                switch (command)
                {
                    case "U":
                        connection.Toggle(driveForward);
                        System.Threading.Thread.Sleep(300);
                        connection.Toggle(driveForward);
                        break;
                    case "D":
                        connection.Toggle(driveBackward);
                        System.Threading.Thread.Sleep(300);
                        connection.Toggle(driveBackward);
                        break;
                    case "UL":
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnLeft);
                        System.Threading.Thread.Sleep(400);
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnLeft);
                        break;
                    case "UR":
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnRight);
                        System.Threading.Thread.Sleep(400);
                        connection.Toggle(driveForward);
                        connection.Toggle(driveTurnRight);
                        break;
                    case "DL":
                        connection.Toggle(driveBackward);
                        connection.Toggle(driveTurnLeft);
                        System.Threading.Thread.Sleep(400);
                        connection.Toggle(driveBackward);
                        connection.Toggle(driveTurnLeft);
                        break;
                    case "DR":
                        connection.Toggle(driveBackward);
                        connection.Toggle(driveTurnRight);
                        System.Threading.Thread.Sleep(400);
                        connection.Toggle(driveBackward);
                        connection.Toggle(driveTurnRight);
                        break;
                    default: Console.WriteLine("Unknown command {0} Expected command to be one of U D UL UR DL DR", command);
                        break;
                }
            }
            connection.Close();
        }
    }
}
