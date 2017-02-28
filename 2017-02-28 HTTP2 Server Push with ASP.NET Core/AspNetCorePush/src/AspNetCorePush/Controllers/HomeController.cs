using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace AspNetPush.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        public IActionResult HttpNoPush()
        {
            return View();
        }

        public IActionResult HttpWithPush()
        {
            return View();
        }

        public IActionResult Kittens()
        {
            return View();
        }
    }
}
